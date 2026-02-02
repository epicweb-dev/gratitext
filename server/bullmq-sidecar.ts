import 'dotenv/config'
import chalk from 'chalk'
import closeWithGrace from 'close-with-grace'
import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import { sendNextTexts } from '#app/utils/cron.server.ts'
import { init as initEnv } from '#app/utils/env.server.ts'
import { getInstanceInfo } from '#app/utils/litefs.server.ts'

const QUEUE_NAME = 'cron-sidecar'
const JOB_NAME = 'send-next-texts'
const DEFAULT_INTERVAL_MS = 5000
const MIN_INTERVAL_MS = 1000

initEnv()

function getSidecarIntervalMs() {
	const rawValue = Number(process.env.CRON_SIDECAR_INTERVAL_MS)
	if (!Number.isFinite(rawValue) || rawValue <= 0) {
		return DEFAULT_INTERVAL_MS
	}
	return Math.max(rawValue, MIN_INTERVAL_MS)
}

function getRedisConnectionOptions(): ConnectionOptions {
	const redisUrl = process.env.REDIS_URL
	if (!redisUrl) {
		throw new Error('REDIS_URL is required for the bullmq sidecar.')
	}

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

const connection = getRedisConnectionOptions()
const queue = new Queue(QUEUE_NAME, { connection })
const intervalMs = getSidecarIntervalMs()

await queue.upsertJobScheduler(
	JOB_NAME,
	{ every: intervalMs },
	{
		name: JOB_NAME,
		data: {},
		opts: {
			removeOnComplete: true,
			removeOnFail: { count: 50 },
		},
	},
)

const worker = new Worker(
	QUEUE_NAME,
	async () => {
		const { currentIsPrimary } = await getInstanceInfo()
		if (!currentIsPrimary) return
		await sendNextTexts()
	},
	{ connection, concurrency: 1 },
)

worker.on('failed', (job, error) => {
	console.error(
		chalk.red(
			`bullmq sidecar job ${job?.id ?? 'unknown'} failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		),
	)
})

worker.on('error', (error) => {
	console.error(
		chalk.red(
			`bullmq sidecar error: ${
				error instanceof Error ? error.message : String(error)
			}`,
		),
	)
})

closeWithGrace(async ({ err }) => {
	if (err) {
		console.error(chalk.red(err))
		console.error(chalk.red(err.stack))
	}
	await worker.close()
	await queue.close()
})
