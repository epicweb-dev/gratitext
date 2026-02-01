import 'dotenv/config'
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'
import { getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'

type BackfillOptions = {
	batchSize: number
	onlyMissing: boolean
}

function parseOptions(): BackfillOptions {
	const { values } = parseArgs({
		options: {
			'batch-size': { type: 'string' },
			'only-missing': { type: 'boolean' },
		},
		allowPositionals: true,
	})

	const batchSize = Number(values['batch-size'] ?? 200)
	return {
		batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 200,
		onlyMissing: values['only-missing'] ?? false,
	}
}

async function run() {
	const options = parseOptions()
	const start = performance.now()

	const lastSentRows = await prisma.message.groupBy({
		by: ['recipientId'],
		_max: { sentAt: true },
		where: { sentAt: { not: null } },
	})
	const lastSentMap = new Map(
		lastSentRows.map((row) => [row.recipientId, row._max.sentAt ?? null]),
	)

	const total = await prisma.recipient.count()
	let offset = 0
	let updated = 0

	while (true) {
		const recipients = await prisma.recipient.findMany({
			orderBy: { id: 'asc' },
			skip: offset,
			take: options.batchSize,
			select: {
				id: true,
				scheduleCron: true,
				timeZone: true,
				prevScheduledAt: true,
				nextScheduledAt: true,
				lastSentAt: true,
			},
		})

		if (!recipients.length) break

		const updates = recipients.flatMap((recipient) => {
			const lastSentAt = lastSentMap.get(recipient.id) ?? null
			const shouldUpdateSchedule =
				!options.onlyMissing ||
				!recipient.prevScheduledAt ||
				!recipient.nextScheduledAt
			const shouldUpdateLastSent =
				!options.onlyMissing || !recipient.lastSentAt

			const data: {
				prevScheduledAt?: Date | null
				nextScheduledAt?: Date | null
				lastSentAt?: Date | null
			} = {}

			if (shouldUpdateSchedule) {
				try {
					const scheduleWindow = getScheduleWindow(
						recipient.scheduleCron,
						recipient.timeZone,
						new Date(),
					)
					data.prevScheduledAt = scheduleWindow.prevScheduledAt
					data.nextScheduledAt = scheduleWindow.nextScheduledAt
				} catch {
					data.prevScheduledAt = null
					data.nextScheduledAt = null
				}
			}

			if (shouldUpdateLastSent && lastSentAt !== recipient.lastSentAt) {
				data.lastSentAt = lastSentAt
			}

			if (!Object.keys(data).length) return []

			return prisma.recipient.update({
				where: { id: recipient.id },
				data,
			})
		})

		if (updates.length) {
			await prisma.$transaction(updates)
			updated += updates.length
		}

		offset += recipients.length
		const elapsed = Math.round(performance.now() - start)
		console.log(
			`Processed ${Math.min(offset, total)}/${total} recipients in ${elapsed}ms`,
		)
	}

	console.log(`Backfill complete. Updated ${updated} recipients.`)
}

await run()
	.catch((error) => {
		console.error('Backfill failed:', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
