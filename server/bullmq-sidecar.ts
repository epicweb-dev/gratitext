import 'dotenv/config'
import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import chalk from 'chalk'
import closeWithGrace from 'close-with-grace'
import {
	BULLMQ_SIDECAR_QUEUE,
	createSidecarProcessor,
	getRedisConnectionOptions,
	getSidecarIntervalMs,
	getSidecarJobSchedulerConfig,
} from '#app/utils/bullmq-sidecar.server.ts'
import { init as initEnv } from '#app/utils/env.server.ts'

initEnv()

const connection = getRedisConnectionOptions()
const queue = new Queue(BULLMQ_SIDECAR_QUEUE, { connection })
const intervalMs = getSidecarIntervalMs()
const { jobSchedulerId, repeat, jobTemplate } =
	getSidecarJobSchedulerConfig(intervalMs)

await queue.upsertJobScheduler(jobSchedulerId, repeat, jobTemplate)

const worker = new Worker(BULLMQ_SIDECAR_QUEUE, createSidecarProcessor(), {
	connection,
	concurrency: 1,
})

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
