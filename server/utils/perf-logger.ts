import crypto from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { NextFunction, Request, Response } from 'express'

type PerfLoggerOptions = {
	enabled: boolean
	sampleRate: number
	slowThresholdMs: number
	skipPaths: string[]
}

type PerfLogEntry = {
	requestId: string
	perfRunId?: string
	method: string
	path: string
	status: number
	outcome: 'finish' | 'close'
	durationMs: number
	cpuMs: { user: number; system: number }
	eventLoop: { utilization: number; activeMs: number; idleMs: number }
	memoryMb: { rss: number; heapUsed: number }
	contentLength: number | null
	timestamp: string
}

const defaultSkipPaths = ['/assets', '/build', '/favicons', '/img', '/fonts']

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

const toMb = (bytes: number) => round(bytes / 1024 / 1024, 2)

export function getPerfLoggerOptionsFromEnv(): PerfLoggerOptions {
	const enabled = process.env.PERF_LOGGING === 'true'
	const sampleRate = clamp(
		toNumber(process.env.PERF_LOG_SAMPLE_RATE, 0.05),
		0,
		1,
	)
	const slowThresholdMs = Math.max(
		0,
		toNumber(process.env.PERF_SLOW_THRESHOLD_MS, 250),
	)
	const envSkipPaths = (process.env.PERF_LOG_SKIP_PATHS ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)

	return {
		enabled,
		sampleRate,
		slowThresholdMs,
		skipPaths: envSkipPaths.length ? envSkipPaths : defaultSkipPaths,
	}
}

export function createPerfLogger(options: PerfLoggerOptions) {
	if (!options.enabled) return null

	return (req: Request, res: Response, next: NextFunction) => {
		const path = req.path
		if (options.skipPaths.some((prefix) => path.startsWith(prefix))) {
			next()
			return
		}

		const requestId = crypto.randomUUID()
		const perfRunId = req.get('x-perf-run-id') ?? undefined
		const start = performance.now()
		const cpuStart = process.cpuUsage()
		const eluStart = performance.eventLoopUtilization()
		let completed = false

		res.setHeader('x-request-id', requestId)

		const onDone = (outcome: 'finish' | 'close') => {
			if (completed) return
			completed = true

			const durationMs = performance.now() - start
			const shouldLog =
				durationMs >= options.slowThresholdMs ||
				res.statusCode >= 500 ||
				Math.random() < options.sampleRate

			if (!shouldLog) return

			const cpuUsage = process.cpuUsage(cpuStart)
			const elu = performance.eventLoopUtilization(eluStart)
			const memory = process.memoryUsage()
			const contentLengthHeader = res.getHeader('content-length')
			const contentLength = contentLengthHeader
				? Number(contentLengthHeader)
				: null

			const entry: PerfLogEntry = {
				requestId,
				perfRunId,
				method: req.method,
				path,
				status: res.statusCode,
				outcome,
				durationMs: round(durationMs, 2),
				cpuMs: {
					user: round(cpuUsage.user / 1000, 2),
					system: round(cpuUsage.system / 1000, 2),
				},
				eventLoop: {
					utilization: round(elu.utilization, 3),
					activeMs: round(elu.active, 2),
					idleMs: round(elu.idle, 2),
				},
				memoryMb: {
					rss: toMb(memory.rss),
					heapUsed: toMb(memory.heapUsed),
				},
				contentLength: Number.isFinite(contentLength) ? contentLength : null,
				timestamp: new Date().toISOString(),
			}

			console.info(`server-perf: ${JSON.stringify(entry)}`)
		}

		res.once('finish', () => onDone('finish'))
		res.once('close', () => onDone('close'))
		next()
	}
}
