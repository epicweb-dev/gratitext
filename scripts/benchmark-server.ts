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

	const baseUrl =
		values['base-url'] ?? process.env.BENCH_BASE_URL ?? 'http://localhost:3000'
	const iterations = Math.max(
		1,
		Math.floor(
			toNumber(values.iterations, toNumber(process.env.BENCH_ITERATIONS, 20)),
		),
	)
	const concurrency = Math.max(
		1,
		Math.floor(
			toNumber(values.concurrency, toNumber(process.env.BENCH_CONCURRENCY, 4)),
		),
	)
	const timeoutMs = Math.max(
		100,
		Math.floor(
			toNumber(values.timeout, toNumber(process.env.BENCH_TIMEOUT_MS, 10000)),
		),
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
