import 'dotenv/config'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import { CronParseError, getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const MESSAGES_PER_PAGE = 100

type Summary = {
	min: number
	max: number
	avg: number
	median: number
}

type BenchResult = {
	query: Summary
	compute?: Summary
	meta?: Record<string, unknown>
}

function summarize(values: number[]): Summary {
	const sorted = [...values].sort((a, b) => a - b)
	const total = values.reduce((acc, value) => acc + value, 0)
	const avg = values.length ? total / values.length : 0
	if (sorted.length === 0) {
		return {
			min: 0,
			max: 0,
			avg: 0,
			median: 0,
		}
	}
	const mid = Math.floor(sorted.length / 2)
	const first = sorted[0]!
	const last = sorted[sorted.length - 1]!
	const lower = sorted[mid - 1] ?? first
	const upper = sorted[mid] ?? last
	const median = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper
	return {
		min: first,
		max: last,
		avg,
		median,
	}
}

function formatScheduleDisplay(date: Date, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone,
		timeZoneName: 'short',
	})
	const parts = formatter.formatToParts(date)
	const getPart = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value
	const weekday = getPart('weekday') ?? ''
	const hour = getPart('hour') ?? ''
	const minute = getPart('minute') ?? '00'
	const dayPeriod = getPart('dayPeriod') ?? ''
	const timeZoneName = getPart('timeZoneName') ?? ''
	return `Every ${weekday} at ${hour}:${minute} ${dayPeriod} ${timeZoneName}`.trim()
}

function parseOptions() {
	const { values } = parseArgs({
		options: {
			iterations: { type: 'string', short: 'i' },
			warmup: { type: 'boolean' },
			'recipient-id': { type: 'string' },
		},
		allowPositionals: true,
	})

	const iterations = Number(
		values.iterations ?? process.env.BENCH_ITERATIONS ?? 3,
	)
	const warmup = values.warmup ?? true
	const recipientId = values['recipient-id'] ?? process.env.BENCH_RECIPIENT_ID

	return {
		iterations: Number.isFinite(iterations) && iterations > 0 ? iterations : 3,
		warmup,
		recipientId,
	}
}

async function getCounts() {
	const [users, recipients, messages] = await prisma.$transaction([
		prisma.user.count(),
		prisma.recipient.count(),
		prisma.message.count(),
	])
	return { users, recipients, messages }
}

async function benchmarkRecipientsList(
	iterations: number,
): Promise<BenchResult> {
	const querySamples: number[] = []
	const computeSamples: number[] = []
	const cronErrors: number[] = []
	let lastCount = 0

	for (let i = 0; i < iterations; i++) {
		const now = new Date()
		const queryStart = performance.now()
		const recipients = await prisma.recipient.findMany({
			select: {
				id: true,
				name: true,
				phoneNumber: true,
				scheduleCron: true,
				timeZone: true,
				disabled: true,
				prevScheduledAt: true,
				nextScheduledAt: true,
				_count: { select: { messages: { where: { sentAt: null } } } },
			},
		})
		const queryMs = performance.now() - queryStart

		const computeStart = performance.now()
		let errors = 0
		const sortedRecipients = recipients
			.map((recipient) => {
				try {
					const scheduleWindow =
						recipient.nextScheduledAt &&
						recipient.prevScheduledAt &&
						recipient.nextScheduledAt > now
							? {
									nextScheduledAt: recipient.nextScheduledAt,
									prevScheduledAt: recipient.prevScheduledAt,
								}
							: getScheduleWindow(
									recipient.scheduleCron,
									recipient.timeZone,
									now,
								)
					return {
						...recipient,
						nextScheduledAt: scheduleWindow.nextScheduledAt,
						prevScheduledAt: scheduleWindow.prevScheduledAt,
						cronError: null as string | null,
					}
				} catch (error) {
					errors += 1
					return {
						...recipient,
						nextScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
						cronError:
							error instanceof CronParseError ? error.message : 'Invalid cron',
					}
				}
			})
			.sort((a, b) => {
				if (a.disabled !== b.disabled) {
					return a.disabled ? 1 : -1
				}
				return a.nextScheduledAt.getTime() - b.nextScheduledAt.getTime()
			})

		sortedRecipients.forEach((recipient) => {
			const scheduleDisplay = recipient.disabled
				? 'Paused'
				: recipient.cronError
					? 'Schedule issue'
					: formatScheduleDisplay(recipient.nextScheduledAt, recipient.timeZone)
			void scheduleDisplay
		})

		const computeMs = performance.now() - computeStart

		querySamples.push(queryMs)
		computeSamples.push(computeMs)
		cronErrors.push(errors)
		lastCount = recipients.length
	}

	return {
		query: summarize(querySamples),
		compute: summarize(computeSamples),
		meta: {
			recipients: lastCount,
			cronErrors,
		},
	}
}

async function findTargetRecipient(recipientId?: string | null) {
	if (recipientId) return recipientId

	const rows = await prisma.$queryRaw<
		Array<{ recipientId: string; total: number }>
	>`SELECT recipientId, COUNT(*) as total FROM Message GROUP BY recipientId ORDER BY total DESC LIMIT 1;`

	return rows[0]?.recipientId ?? null
}

async function findSearchTerm(recipientId: string) {
	const message = await prisma.message.findFirst({
		where: { recipientId, sentAt: { not: null } },
		select: { content: true },
	})

	if (!message?.content) return null
	const words = message.content.split(/\s+/).filter(Boolean)
	return words[0] ?? null
}

async function benchmarkPastMessages(
	iterations: number,
	recipientId: string,
	searchTerm?: string | null,
): Promise<BenchResult> {
	const querySamples: number[] = []
	const computeSamples: number[] = []
	let totalMessages = 0
	let lastPageCount = 0

	for (let i = 0; i < iterations; i++) {
		const queryStart = performance.now()
		const messageWhere = {
			recipientId,
			sentAt: { not: null },
			...(searchTerm ? { content: { contains: searchTerm } } : {}),
		}
		const total = await prisma.message.count({
			where: messageWhere,
		})
		const countMs = performance.now() - queryStart

		const pageStart = performance.now()
		const messages = await prisma.message.findMany({
			where: messageWhere,
			select: { id: true, content: true, sentAt: true },
			orderBy: { sentAt: 'desc' },
			skip: 0,
			take: MESSAGES_PER_PAGE,
		})
		const pageMs = performance.now() - pageStart

		querySamples.push(countMs)
		computeSamples.push(pageMs)
		totalMessages = total
		lastPageCount = messages.length
	}

	return {
		query: summarize(querySamples),
		compute: summarize(computeSamples),
		meta: {
			recipientId,
			searchTerm: searchTerm ?? null,
			totalMessages,
			pageCount: lastPageCount,
		},
	}
}

async function benchmarkCron(iterations: number): Promise<BenchResult> {
	const querySamples: number[] = []
	const computeSamples: number[] = []
	let totals = { recipients: 0, due: 0, remind: 0, errors: 0 }

	for (let i = 0; i < iterations; i++) {
		const now = new Date()
		const reminderWindowMs = 1000 * 60 * 30
		const reminderCutoff = new Date(now.getTime() + reminderWindowMs)
		const queryStart = performance.now()
		const rawRecipients = await prisma.recipient.findMany({
			where: {
				verified: true,
				disabled: false,
				user: { stripeId: { not: null } },
				OR: [
					{ nextScheduledAt: { lte: reminderCutoff } },
					{ nextScheduledAt: null },
				],
			},
			select: {
				id: true,
				name: true,
				scheduleCron: true,
				timeZone: true,
				lastRemindedAt: true,
				lastSentAt: true,
				prevScheduledAt: true,
				nextScheduledAt: true,
			},
		})
		const queryMs = performance.now() - queryStart

		const computeStart = performance.now()
		let due = 0
		let remind = 0
		let errors = 0
		for (const recipient of rawRecipients) {
			try {
				const scheduleWindow =
					recipient.nextScheduledAt &&
					recipient.prevScheduledAt &&
					recipient.nextScheduledAt > now
						? {
								nextScheduledAt: recipient.nextScheduledAt,
								prevScheduledAt: recipient.prevScheduledAt,
							}
						: getScheduleWindow(recipient.scheduleCron, recipient.timeZone, now)
				const lastSent = new Date(recipient.lastSentAt ?? 0)
				const nextIsSoon =
					scheduleWindow.nextScheduledAt.getTime() - now.getTime() <
					reminderWindowMs
				const isDue = lastSent < scheduleWindow.prevScheduledAt
				const shouldRemind =
					nextIsSoon &&
					new Date(recipient.lastRemindedAt ?? 0).getTime() <
						scheduleWindow.prevScheduledAt.getTime()

				if (isDue) due += 1
				if (shouldRemind) remind += 1
			} catch {
				errors += 1
			}
		}

		const computeMs = performance.now() - computeStart

		querySamples.push(queryMs)
		computeSamples.push(computeMs)
		totals = {
			recipients: rawRecipients.length,
			due,
			remind,
			errors,
		}
	}

	return {
		query: summarize(querySamples),
		compute: summarize(computeSamples),
		meta: totals,
	}
}

async function run() {
	const options = parseOptions()
	const counts = await getCounts()
	const results: Record<string, unknown> = {
		meta: {
			timestamp: new Date().toISOString(),
			iterations: options.iterations,
			counts,
		},
	}

	if (options.warmup) {
		await prisma.recipient.findFirst({ select: { id: true } })
		await prisma.message.findFirst({ select: { id: true } })
	}

	results.recipientsList = await benchmarkRecipientsList(options.iterations)

	const targetRecipient = await findTargetRecipient(options.recipientId)
	if (targetRecipient) {
		results.pastMessages = await benchmarkPastMessages(
			options.iterations,
			targetRecipient,
			null,
		)
		const searchTerm = await findSearchTerm(targetRecipient)
		if (searchTerm) {
			results.pastMessagesSearch = await benchmarkPastMessages(
				options.iterations,
				targetRecipient,
				searchTerm,
			)
		}
	} else {
		results.pastMessages = { skipped: true }
	}

	results.cron = await benchmarkCron(options.iterations)

	console.log(JSON.stringify(results, null, 2))
}

await run()
	.catch((error) => {
		console.error('Benchmark failed:', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
