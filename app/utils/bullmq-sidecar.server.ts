import type {
	ConnectionOptions,
	JobSchedulerTemplateOptions,
	RepeatOptions,
} from 'bullmq'
import { sendNextTexts } from './cron.server.ts'
import { getInstanceInfo } from './litefs.server.ts'

export const BULLMQ_SIDECAR_QUEUE = 'cron-sidecar'
export const BULLMQ_SIDECAR_JOB = 'send-next-texts'
export const DEFAULT_SIDECAR_INTERVAL_MS = 5000
export const MIN_SIDECAR_INTERVAL_MS = 1000

type IntervalConfig = {
	defaultMs?: number
	minMs?: number
}

export function getSidecarIntervalMs(
	env: NodeJS.ProcessEnv = process.env,
	{
		defaultMs = DEFAULT_SIDECAR_INTERVAL_MS,
		minMs = MIN_SIDECAR_INTERVAL_MS,
	}: IntervalConfig = {},
) {
	const rawValue = Number(env.CRON_SIDECAR_INTERVAL_MS)
	if (!Number.isFinite(rawValue) || rawValue <= 0) {
		return defaultMs
	}
	return Math.max(rawValue, minMs)
}

export function getRedisConnectionOptionsFromUrl(
	redisUrl: string,
): ConnectionOptions {
	let parsedUrl: URL
	try {
		parsedUrl = new URL(redisUrl)
	} catch {
		throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.')
	}

	if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
		throw new Error('REDIS_URL must start with redis:// or rediss://')
	}

	const db =
		parsedUrl.pathname.length > 1 ? Number(parsedUrl.pathname.slice(1)) : NaN

	return {
		host: parsedUrl.hostname,
		port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
		username: parsedUrl.username || undefined,
		password: parsedUrl.password || undefined,
		db: Number.isFinite(db) ? db : undefined,
		tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
	}
}

export function getRedisConnectionOptions(
	env: NodeJS.ProcessEnv = process.env,
): ConnectionOptions {
	const redisUrl = env.REDIS_URL
	if (!redisUrl) {
		throw new Error('REDIS_URL is required for the bullmq sidecar.')
	}
	return getRedisConnectionOptionsFromUrl(redisUrl)
}

export type SidecarJobSchedulerConfig = {
	jobSchedulerId: string
	repeat: Omit<RepeatOptions, 'key'>
	jobTemplate: {
		name: string
		data: Record<string, never>
		opts: JobSchedulerTemplateOptions
	}
}

export function getSidecarJobSchedulerConfig(
	intervalMs: number,
	jobName = BULLMQ_SIDECAR_JOB,
): SidecarJobSchedulerConfig {
	return {
		jobSchedulerId: jobName,
		repeat: { every: intervalMs },
		jobTemplate: {
			name: jobName,
			data: {},
			opts: {
				removeOnComplete: true,
				removeOnFail: { count: 50 },
			},
		},
	}
}

type SidecarProcessorDeps = {
	getInstanceInfo?: typeof getInstanceInfo
	sendNextTexts?: typeof sendNextTexts
}

export function createSidecarProcessor({
	getInstanceInfo: getInstanceInfoFn = getInstanceInfo,
	sendNextTexts: sendNextTextsFn = sendNextTexts,
}: SidecarProcessorDeps = {}) {
	return async () => {
		const { currentIsPrimary } = await getInstanceInfoFn()
		if (!currentIsPrimary) return
		await sendNextTextsFn()
	}
}
