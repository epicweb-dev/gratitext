import crypto from 'node:crypto'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'

type Summary = {
	min: number
	max: number
	avg: number
	median: number
	p90: number
	p95: number
	p99: number
}

type RequestResult = {
	durationMs: number
	status: number | null
	serverTiming: string | null
	error?: string
}

type RouteReport = {
	summary: Summary
	statuses: Record<string, number>
	errors: Record<string, number>
	samples: { serverTiming: string[] }
}

const DEFAULT_ROUTES = [
	'/',
	'/login',
	'/signup',
	'/resources/healthcheck',
]

const toNumber = (value: string | undefined, fallback: number) => {
	if (!value) return fallback
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

function percentile(sorted: number[], p: number) {
	if (sorted.length === 0) return 0
	const index = Math.ceil((p / 100) * sorted.length) - 1
	const clampedIndex = Math.max(0, Math.min(sorted.length - 1, index))
	return sorted[clampedIndex] ?? 0
}

function summarize(values: number[]): Summary {
	const sorted = [...values].sort((a, b) => a - b)
	const total = values.reduce((acc, value) => acc + value, 0)
	const avg = values.length ? total / values.length : 0
	const median =
		sorted.length === 0
			? 0
			: sorted.length % 2 === 0
				? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
				: sorted[Math.floor(sorted.length / 2)]!

	return {
		min: sorted[0] ?? 0,
		max: sorted[sorted.length - 1] ?? 0,
		avg,
		median,
		p90: percentile(sorted, 90),
		p95: percentile(sorted, 95),
		p99: percentile(sorted, 99),
	}
}

function parseOptions() {
	const { values } = parseArgs({
		options: {
			'base-url': { type: 'string' },
			iterations: { type: 'string', short: 'i' },
			concurrency: { type: 'string', short: 'c' },
			timeout: { type: 'string', short: 't' },
			warmup: { type: 'boolean' },
			route: { type: 'string', multiple: true },
			output: { type: 'string' },
		},
		allowPositionals: true,
	})

	const baseUrl = values['base-url'] ?? process.env.BENCH_BASE_URL ?? 'http://localhost:3000'
	const iterations = Math.max(
		1,
		Math.floor(toNumber(values.iterations, toNumber(process.env.BENCH_ITERATIONS, 20))),
	)
	const concurrency = Math.max(
		1,
		Math.floor(toNumber(values.concurrency, toNumber(process.env.BENCH_CONCURRENCY, 4))),
	)
	const timeoutMs = Math.max(
		100,
		Math.floor(toNumber(values.timeout, toNumber(process.env.BENCH_TIMEOUT_MS, 10000))),
	)
	const routes = values.route?.length
		? values.route
		: (process.env.BENCH_ROUTES ?? '')
				.split(',')
				.map((route) => route.trim())
				.filter(Boolean)

	return {
		baseUrl,
		iterations,
		concurrency,
		timeoutMs,
		warmup: values.warmup ?? true,
		routes: routes.length ? routes : DEFAULT_ROUTES,
		output: values.output ?? process.env.BENCH_OUTPUT ?? null,
	}
}

async function requestOnce(
	baseUrl: string,
	route: string,
	timeoutMs: number,
	perfRunId: string,
): Promise<RequestResult> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	const start = performance.now()

	try {
		const response = await fetch(`${baseUrl}${route}`, {
			signal: controller.signal,
			headers: {
				'x-perf-run-id': perfRunId,
				'cache-control': 'no-store',
			},
		})
		const serverTiming = response.headers.get('server-timing')
		await response.arrayBuffer()
		return {
			durationMs: performance.now() - start,
			status: response.status,
			serverTiming,
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown error'
		return {
			durationMs: performance.now() - start,
			status: null,
			serverTiming: null,
			error: message,
		}
	} finally {
		clearTimeout(timeout)
	}
}

async function runRouteBenchmark(
	baseUrl: string,
	route: string,
	iterations: number,
	concurrency: number,
	timeoutMs: number,
	perfRunId: string,
): Promise<RouteReport> {
	const results: RequestResult[] = []
	let index = 0

	const workers = Array.from({ length: concurrency }, async () => {
		while (index < iterations) {
			const current = index
			index += 1
			if (current >= iterations) break
			results.push(await requestOnce(baseUrl, route, timeoutMs, perfRunId))
		}
	})

	await Promise.all(workers)

	const durations = results
		.filter((result) => result.status !== null)
		.map((result) => result.durationMs)
	const statusCounts: Record<string, number> = {}
	const errorCounts: Record<string, number> = {}
	const serverTimingSamples: string[] = []

	for (const result of results) {
		if (result.status !== null) {
			const key = String(result.status)
			statusCounts[key] = (statusCounts[key] ?? 0) + 1
		}
		if (result.error) {
			errorCounts[result.error] = (errorCounts[result.error] ?? 0) + 1
		}
		if (result.serverTiming && serverTimingSamples.length < 5) {
			serverTimingSamples.push(result.serverTiming)
		}
	}

	return {
		summary: summarize(durations),
		statuses: statusCounts,
		errors: errorCounts,
		samples: { serverTiming: serverTimingSamples },
	}
}

async function run() {
	const options = parseOptions()
	const perfRunId = crypto.randomUUID()

	const report: Record<string, unknown> = {
		meta: {
			timestamp: new Date().toISOString(),
			baseUrl: options.baseUrl,
			iterations: options.iterations,
			concurrency: options.concurrency,
			timeoutMs: options.timeoutMs,
			warmup: options.warmup,
			perfRunId,
		},
		routes: {},
	}

	if (options.warmup) {
		for (const route of options.routes) {
			await requestOnce(options.baseUrl, route, options.timeoutMs, perfRunId)
		}
	}

	for (const route of options.routes) {
		const result = await runRouteBenchmark(
			options.baseUrl,
			route,
			options.iterations,
			options.concurrency,
			options.timeoutMs,
			perfRunId,
		)
		;(report.routes as Record<string, RouteReport>)[route] = result
	}

	const output = JSON.stringify(report, null, 2)
	console.log(output)

	if (options.output) {
		fs.writeFileSync(options.output, output)
	}
}

await run().catch((error) => {
	console.error('Benchmark failed:', error)
	process.exitCode = 1
})
import crypto from 'node:crypto'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'

type Summary = {
	min: number
	max: number
	avg: number
	median: number
	p90: number
	p95: number
	p99: number
}

type RequestResult = {
	durationMs: number
	status?: number
	serverTiming?: string | null
	error?: string
}

type RouteReport = {
	summary: Summary
	statusCounts: Record<string, number>
	errorCount: number
	errorSamples: string[]
	serverTimingSamples: string[]
}

type Options = {
	baseUrl: string
	iterations: number
	concurrency: number
	warmup: boolean
	timeoutMs: number
	routes: string[]
	output?: string
	perfRunId: string
}

const toNumber = (value: string | undefined, fallback: number) => {
	if (!value) return fallback
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value))

const round = (value: number, digits = 2) => {
	const factor = 10 ** digits
	return Math.round(value * factor) / factor
}

const percentile = (sorted: number[], p: number) => {
	if (sorted.length === 0) return 0
	const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)
	return sorted[index] ?? 0
}

const summarize = (values: number[]): Summary => {
	if (values.length === 0) {
		return { min: 0, max: 0, avg: 0, median: 0, p90: 0, p95: 0, p99: 0 }
	}
	const sorted = [...values].sort((a, b) => a - b)
	const total = values.reduce((acc, value) => acc + value, 0)
	const mid = Math.floor(sorted.length / 2)
	const median =
		sorted.length % 2 === 0
			? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
			: sorted[mid] ?? 0

	return {
		min: sorted[0] ?? 0,
		max: sorted[sorted.length - 1] ?? 0,
		avg: total / values.length,
		median,
		p90: percentile(sorted, 0.9),
		p95: percentile(sorted, 0.95),
		p99: percentile(sorted, 0.99),
	}
}

const normalizeRoute = (route: string) => {
	if (!route.startsWith('/')) return `/${route}`
	return route
}

const parseOptions = (): Options => {
	const { values } = parseArgs({
		options: {
			'base-url': { type: 'string' },
			iterations: { type: 'string', short: 'i' },
			concurrency: { type: 'string', short: 'c' },
			warmup: { type: 'boolean' },
			'timeout-ms': { type: 'string' },
			route: { type: 'string', multiple: true },
			output: { type: 'string' },
		},
		allowPositionals: true,
	})

	const baseUrl = values['base-url'] ?? process.env.BENCH_BASE_URL ?? ''
	const iterations = Math.max(
		1,
		Math.floor(toNumber(values.iterations, 20)),
	)
	const concurrency = Math.max(
		1,
		Math.floor(toNumber(values.concurrency, 4)),
	)
	const warmup = values.warmup ?? true
	const timeoutMs = Math.max(
		100,
		Math.floor(toNumber(values['timeout-ms'], 15000)),
	)

	const routes =
		values.route && values.route.length > 0
			? values.route.map(normalizeRoute)
			: (process.env.BENCH_ROUTES ?? '')
					.split(',')
					.map((route) => route.trim())
					.filter(Boolean)
					.map(normalizeRoute)

	const defaultRoutes = [
		'/',
		'/login',
		'/signup',
		'/resources/healthcheck',
	]

	return {
		baseUrl: baseUrl || 'http://localhost:3000',
		iterations,
		concurrency,
		warmup,
		timeoutMs,
		routes: routes.length ? routes : defaultRoutes,
		output: values.output ?? undefined,
		perfRunId: `perf-${crypto.randomUUID()}`,
	}
}

const requestOnce = async (
	baseUrl: string,
	route: string,
	timeoutMs: number,
	perfRunId: string,
): Promise<RequestResult> => {
	const url = new URL(route, baseUrl).toString()
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), timeoutMs)
	const start = performance.now()

	try {
		const response = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
			headers: {
				'x-perf-run-id': perfRunId,
				'cache-control': 'no-cache',
			},
		})
		const serverTiming = response.headers.get('server-timing')
		await response.arrayBuffer()
		return {
			durationMs: performance.now() - start,
			status: response.status,
			serverTiming,
		}
	} catch (error) {
		return {
			durationMs: performance.now() - start,
			error: error instanceof Error ? error.message : 'Request failed',
		}
	} finally {
		clearTimeout(timeout)
	}
}

const runRoute = async (options: Options, route: string) => {
	const results: RequestResult[] = []
	const runBatch = async (count: number) => {
		const batch = Array.from({ length: count }, () =>
			requestOnce(options.baseUrl, route, options.timeoutMs, options.perfRunId),
		)
		results.push(...(await Promise.all(batch)))
	}

	for (let i = 0; i < options.iterations; i += options.concurrency) {
		const batchSize = Math.min(options.concurrency, options.iterations - i)
		await runBatch(batchSize)
	}

	const durations = results.map((result) => result.durationMs)
	const statusCounts = results.reduce<Record<string, number>>((acc, result) => {
		const key = result.status ? String(result.status) : 'error'
		acc[key] = (acc[key] ?? 0) + 1
		return acc
	}, {})

	const errorSamples = results
		.map((result) => result.error)
		.filter(Boolean)
		.slice(0, 5) as string[]

	const serverTimingSamples = Array.from(
		new Set(
			results
				.map((result) => result.serverTiming)
				.filter((value): value is string => Boolean(value)),
		),
	).slice(0, 5)

	const report: RouteReport = {
		summary: {
			...summarize(durations),
			min: round(summarize(durations).min, 2),
			max: round(summarize(durations).max, 2),
			avg: round(summarize(durations).avg, 2),
			median: round(summarize(durations).median, 2),
			p90: round(summarize(durations).p90, 2),
			p95: round(summarize(durations).p95, 2),
			p99: round(summarize(durations).p99, 2),
		},
		statusCounts,
		errorCount: errorSamples.length,
		errorSamples,
		serverTimingSamples,
	}

	return report
}

const run = async () => {
	const options = parseOptions()

	if (options.warmup) {
		for (const route of options.routes) {
			await requestOnce(
				options.baseUrl,
				route,
				options.timeoutMs,
				options.perfRunId,
			)
		}
	}

	const routesReport: Record<string, RouteReport> = {}
	for (const route of options.routes) {
		routesReport[route] = await runRoute(options, route)
	}

	const report = {
		meta: {
			timestamp: new Date().toISOString(),
			baseUrl: options.baseUrl,
			iterations: options.iterations,
			concurrency: options.concurrency,
			warmup: options.warmup,
			timeoutMs: options.timeoutMs,
			perfRunId: options.perfRunId,
		},
		routes: routesReport,
	}

	const output = JSON.stringify(report, null, 2)
	console.log(output)

	if (options.output) {
		fs.writeFileSync(options.output, output)
	}
}

await run().catch((error) => {
	console.error('Benchmark failed:', error)
	process.exitCode = 1
})
