import 'dotenv/config'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import { seedMissingRecipientJobs } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'

type BackfillOptions = {
	batchSize: number
}

function parseOptions(): BackfillOptions {
	const { values } = parseArgs({
		options: {
			'batch-size': { type: 'string' },
		},
		allowPositionals: true,
	})
	const batchSize = Number(values['batch-size'] ?? 200)
	return {
		batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 200,
	}
}

async function run() {
	const options = parseOptions()
	const start = performance.now()
	const seeded = await seedMissingRecipientJobs({
		batchSize: options.batchSize,
		reschedule: false,
	})
	const elapsed = Math.round(performance.now() - start)
	console.log(
		`Backfill complete. Seeded ${seeded} recipient jobs in ${elapsed}ms.`,
	)
}

await run()
	.catch((error) => {
		console.error('Backfill failed:', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
