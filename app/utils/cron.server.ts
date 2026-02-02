/*
 * This entire file should be swapped for something more official.
 * Probably inngest... But we're gonna stick with this for now and see how far
 * it gets us.
 */
import { appendFile } from 'node:fs/promises'
import { remember } from '@epic-web/remember'
import { CronExpressionParser } from 'cron-parser'
import { prisma } from './db.server.ts'
import { sendText, sendTextToRecipient } from './text.server.ts'

export class CronParseError extends Error {
	constructor(
		message: string,
		public readonly cronString: string,
	) {
		super(message)
		this.name = 'CronParseError'
	}
}

function parseCronExpression(
	cronString: string,
	options?: { tz?: string; currentDate?: Date },
) {
	try {
		return CronExpressionParser.parse(cronString, options)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Invalid cron string'
		throw new CronParseError(errorMessage, cronString)
	}
}

export function getScheduleWindow(
	scheduleCron: string,
	timeZone: string,
	currentDate: Date = new Date(),
) {
	const interval = parseCronExpression(scheduleCron, {
		tz: timeZone,
		currentDate,
	})
	const prevScheduledAt = interval.prev().toDate()
	const nextScheduledAt = interval.next().toDate()
	return { prevScheduledAt, nextScheduledAt }
}

const REMINDER_WINDOW_MS = 1000 * 60 * 30
const OVERDUE_WINDOW_MS = 1000 * 60 * 10
const JOB_RETRY_DELAY_MS = 1000 * 5
const JOB_BATCH_SIZE = 50
const JOB_SEED_BATCH_SIZE = 200
const INVALID_CRON_RETRY_MS = 1000 * 60 * 60 * 24
const MAX_TIMEOUT_MS = 2_147_483_647
const MAX_IDLE_CHECK_MS = 1000 * 30

const DEBUG_LOG_PATH = process.env.CRON_DEBUG_LOG_PATH
const DEBUG_LOG_KEY = 'cron-job-debug'
const DEBUG_ENABLED = Boolean(DEBUG_LOG_PATH)

function logDebug(payload: {
	hypothesisId: string
	location: string
	message: string
	data?: Record<string, unknown>
}) {
	if (!DEBUG_ENABLED || !DEBUG_LOG_PATH) return
	const entry = `${DEBUG_LOG_KEY}: ${JSON.stringify({
		...payload,
		timestamp: Date.now(),
	})}\n`
	void appendFile(DEBUG_LOG_PATH, entry)
}

type RecipientJobSeedData = {
	id: string
	scheduleCron: string
	timeZone: string
	prevScheduledAt: Date | null
	nextScheduledAt: Date | null
	lastSentAt: Date | null
}

type JobSchedulerState = {
	timeout: ReturnType<typeof setTimeout> | null
	isProcessing: boolean
	rescheduleRequested: boolean
}

const jobSchedulerRef = remember<{ current: JobSchedulerState }>(
	'recipientJobScheduler',
	() => ({
		current: {
			timeout: null,
			isProcessing: false,
			rescheduleRequested: false,
		},
	}),
)

function getReminderWindowStart(nextScheduledAt: Date) {
	return new Date(nextScheduledAt.getTime() - REMINDER_WINDOW_MS)
}

function computeJobRunAt(recipient: RecipientJobSeedData, now: Date) {
	const scheduleWindow = getScheduleWindow(
		recipient.scheduleCron,
		recipient.timeZone,
		now,
	)
	const lastSent = new Date(recipient.lastSentAt ?? 0)
	const overdueMs = now.getTime() - scheduleWindow.prevScheduledAt.getTime()
	const due = lastSent < scheduleWindow.prevScheduledAt
	if (due && overdueMs <= OVERDUE_WINDOW_MS) {
		return { scheduleWindow, runAt: now }
	}
	const reminderWindowStart = getReminderWindowStart(
		scheduleWindow.nextScheduledAt,
	)
	return {
		scheduleWindow,
		runAt: reminderWindowStart <= now ? now : reminderWindowStart,
	}
}

async function scheduleNextJobRun() {
	if (jobSchedulerRef.current.timeout) {
		clearTimeout(jobSchedulerRef.current.timeout)
		jobSchedulerRef.current.timeout = null
	}
	const nextJob = await prisma.recipientJob.findFirst({
		select: { runAt: true },
		orderBy: { runAt: 'asc' },
	})
	if (!nextJob) {
		jobSchedulerRef.current.timeout = setTimeout(() => {
			void runScheduledJobs()
		}, MAX_IDLE_CHECK_MS)
		return
	}
	const delayMs = Math.max(nextJob.runAt.getTime() - Date.now(), 0)
	const safeDelayMs = Math.min(delayMs, MAX_TIMEOUT_MS, MAX_IDLE_CHECK_MS)
	jobSchedulerRef.current.timeout = setTimeout(() => {
		void runScheduledJobs()
	}, safeDelayMs)
}

async function requestJobReschedule() {
	if (jobSchedulerRef.current.isProcessing) {
		jobSchedulerRef.current.rescheduleRequested = true
		return
	}
	await scheduleNextJobRun()
}

async function runScheduledJobs() {
	if (jobSchedulerRef.current.isProcessing) return
	jobSchedulerRef.current.isProcessing = true
	try {
		logDebug({
			hypothesisId: 'H1',
			location: 'cron.server.ts:runScheduledJobs',
			message: 'job runner tick',
		})
		await seedMissingRecipientJobs({ reschedule: false })
		await sendNextTexts()
	} catch (error) {
		console.error(error)
	} finally {
		jobSchedulerRef.current.isProcessing = false
		jobSchedulerRef.current.rescheduleRequested = false
		await scheduleNextJobRun()
	}
}

async function upsertRecipientJobFromData(
	recipient: RecipientJobSeedData,
	{
		now = new Date(),
		reschedule = true,
	}: { now?: Date; reschedule?: boolean } = {},
) {
	let scheduleWindow: { prevScheduledAt: Date; nextScheduledAt: Date } | null =
		null
	let runAt: Date
	try {
		const computed = computeJobRunAt(recipient, now)
		scheduleWindow = computed.scheduleWindow
		runAt = computed.runAt
	} catch (error) {
		console.error(
			`Invalid cron string "${recipient.scheduleCron}" for recipient ${recipient.id}:`,
			error instanceof Error ? error.message : error,
		)
		runAt = new Date(now.getTime() + INVALID_CRON_RETRY_MS)
		await prisma.recipientJob.upsert({
			where: { recipientId: recipient.id },
			create: { recipientId: recipient.id, runAt },
			update: { runAt },
		})
		if (reschedule) await requestJobReschedule()
		return null
	}

	const shouldUpdateSchedule =
		!recipient.prevScheduledAt ||
		!recipient.nextScheduledAt ||
		recipient.prevScheduledAt.getTime() !==
			scheduleWindow.prevScheduledAt.getTime() ||
		recipient.nextScheduledAt.getTime() !==
			scheduleWindow.nextScheduledAt.getTime()

	const updates = []
	if (shouldUpdateSchedule) {
		updates.push(
			prisma.recipient.update({
				where: { id: recipient.id },
				data: {
					prevScheduledAt: scheduleWindow.prevScheduledAt,
					nextScheduledAt: scheduleWindow.nextScheduledAt,
				},
			}),
		)
	}
	updates.push(
		prisma.recipientJob.upsert({
			where: { recipientId: recipient.id },
			create: { recipientId: recipient.id, runAt },
			update: { runAt },
		}),
	)
	await prisma.$transaction(updates)

	if (reschedule) await requestJobReschedule()
	return scheduleWindow
}

export async function init() {
	console.log('initializing recipient job runner')
	void seedMissingRecipientJobs().catch((error) => {
		console.error('Failed to seed recipient jobs:', error)
	})
	await requestJobReschedule()
}

export async function upsertRecipientJob(
	recipientId: string,
	options: { now?: Date; reschedule?: boolean } = {},
) {
	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId },
		select: {
			id: true,
			scheduleCron: true,
			timeZone: true,
			prevScheduledAt: true,
			nextScheduledAt: true,
			lastSentAt: true,
		},
	})
	if (!recipient) return null
	return upsertRecipientJobFromData(recipient, options)
}

export async function seedMissingRecipientJobs({
	batchSize = JOB_SEED_BATCH_SIZE,
	reschedule = true,
}: { batchSize?: number; reschedule?: boolean } = {}) {
	let lastId: string | undefined
	let seededCount = 0
	while (true) {
		const recipients = await prisma.recipient.findMany({
			where: { job: { is: null } },
			select: {
				id: true,
				scheduleCron: true,
				timeZone: true,
				prevScheduledAt: true,
				nextScheduledAt: true,
				lastSentAt: true,
			},
			orderBy: { id: 'asc' },
			take: batchSize,
			...(lastId
				? {
						cursor: { id: lastId },
						skip: 1,
					}
				: {}),
		})
		if (!recipients.length) break
		for (const recipient of recipients) {
			await upsertRecipientJobFromData(recipient, { reschedule: false })
			seededCount++
		}
		lastId = recipients[recipients.length - 1]?.id
	}
	if (seededCount && reschedule) await requestJobReschedule()
	return seededCount
}

export async function sendNextTexts() {
	let dueSentCount = 0
	let reminderSentCount = 0
	while (true) {
		const now = new Date()
		const jobs = await prisma.recipientJob.findMany({
			select: { id: true, recipientId: true },
			where: { runAt: { lte: now } },
			orderBy: { runAt: 'asc' },
			take: JOB_BATCH_SIZE,
		})
		logDebug({
			hypothesisId: 'H2',
			location: 'cron.server.ts:sendNextTexts',
			message: 'due jobs fetched',
			data: { jobCount: jobs.length },
		})
		if (!jobs.length) break
		for (const job of jobs) {
			const result = await processRecipientJob(job)
			if (result.reminderSent) reminderSentCount++
			if (result.dueSent) dueSentCount++
		}
	}

	if (reminderSentCount) console.log(`Sent ${reminderSentCount} reminders`)
	if (dueSentCount) console.log(`Sent ${dueSentCount} due texts`)
}

async function processRecipientJob(job: { id: string; recipientId: string }) {
	const now = new Date()
	const recipient = await prisma.recipient.findUnique({
		where: { id: job.recipientId },
		select: {
			id: true,
			name: true,
			scheduleCron: true,
			timeZone: true,
			prevScheduledAt: true,
			nextScheduledAt: true,
			lastRemindedAt: true,
			lastSentAt: true,
			verified: true,
			disabled: true,
			user: {
				select: {
					phoneNumber: true,
					name: true,
					stripeId: true,
				},
			},
		},
	})
	if (!recipient) {
		await prisma.recipientJob.delete({ where: { id: job.id } })
		return { reminderSent: false, dueSent: false }
	}

	let scheduleWindow: { prevScheduledAt: Date; nextScheduledAt: Date }
	try {
		scheduleWindow = getScheduleWindow(
			recipient.scheduleCron,
			recipient.timeZone,
			now,
		)
	} catch (error) {
		console.error(
			`Invalid cron string "${recipient.scheduleCron}" for recipient ${recipient.id}:`,
			error instanceof Error ? error.message : error,
		)
		await prisma.recipientJob.update({
			where: { id: job.id },
			data: { runAt: new Date(now.getTime() + INVALID_CRON_RETRY_MS) },
		})
		return { reminderSent: false, dueSent: false }
	}

	const { prevScheduledAt, nextScheduledAt } = scheduleWindow
	const shouldUpdateSchedule =
		!recipient.prevScheduledAt ||
		!recipient.nextScheduledAt ||
		recipient.prevScheduledAt.getTime() !== prevScheduledAt.getTime() ||
		recipient.nextScheduledAt.getTime() !== nextScheduledAt.getTime()
	if (shouldUpdateSchedule) {
		await prisma.recipient.update({
			where: { id: recipient.id },
			data: {
				prevScheduledAt,
				nextScheduledAt,
			},
		})
	}

	const reminderWindowStart = getReminderWindowStart(nextScheduledAt)
	const withinReminderWindow = reminderWindowStart.getTime() <= now.getTime()
	const lastSent = new Date(recipient.lastSentAt ?? 0)
	const due = lastSent < prevScheduledAt
	const remind =
		withinReminderWindow &&
		new Date(recipient.lastRemindedAt ?? 0).getTime() <
			prevScheduledAt.getTime()

	const canProcess =
		recipient.verified &&
		!recipient.disabled &&
		Boolean(recipient.user.stripeId)

	logDebug({
		hypothesisId: 'H3',
		location: 'cron.server.ts:processRecipientJob',
		message: 'job decision',
		data: {
			recipientId: recipient.id,
			due,
			remind,
			canProcess,
			prevScheduledAt: prevScheduledAt.toISOString(),
			nextScheduledAt: nextScheduledAt.toISOString(),
		},
	})

	let reminderSent = false
	let dueSent = false
	let retryAt: Date | null = null

	let nextMessage: {
		id: string
		updatedAt: Date
	} | null = null
	if (canProcess && (remind || due)) {
		nextMessage = await prisma.message.findFirst({
			select: { id: true, updatedAt: true },
			where: { recipientId: recipient.id, sentAt: null },
			orderBy: { order: 'asc' },
		})
	}

	if (canProcess && !nextMessage && remind) {
		const reminderResult = await sendText({
			to: recipient.user.phoneNumber,
			// TODO: don't hardcode the domain somehow...
			message: `Hello ${recipient.user.name}, you forgot to set up a message for ${recipient.name} and the sending time is coming up.\n\nAdd a thoughtful personal message here: https://www.gratitext.app/recipients/${recipient.id}`,
		})
		if (reminderResult.status === 'success') {
			await prisma.recipient.update({
				where: { id: recipient.id },
				data: { lastRemindedAt: new Date() },
			})
			reminderSent = true
		} else {
			retryAt = new Date(now.getTime() + JOB_RETRY_DELAY_MS)
		}
		logDebug({
			hypothesisId: 'H4',
			location: 'cron.server.ts:processRecipientJob',
			message: 'reminder attempt',
			data: { recipientId: recipient.id, status: reminderResult.status },
		})
	}

	// if the message was last updated after the previous time to send then it's
	// overdue and we don't send it automatically
	const overDueTimeMs = now.getTime() - prevScheduledAt.getTime()
	const tooLongOverdue = overDueTimeMs > OVERDUE_WINDOW_MS
	const nextMessageWasReady = nextMessage
		? nextMessage.updatedAt < prevScheduledAt
		: false

	if (
		canProcess &&
		nextMessage &&
		due &&
		nextMessageWasReady &&
		!tooLongOverdue
	) {
		const sendResult = await sendTextToRecipient({
			recipientId: recipient.id,
			messageId: nextMessage.id,
		})
		if (sendResult.status === 'success') {
			dueSent = true
		} else if (now.getTime() < prevScheduledAt.getTime() + OVERDUE_WINDOW_MS) {
			const retryCandidate = new Date(now.getTime() + JOB_RETRY_DELAY_MS)
			retryAt = retryAt && retryAt < retryCandidate ? retryAt : retryCandidate
		}
		logDebug({
			hypothesisId: 'H5',
			location: 'cron.server.ts:processRecipientJob',
			message: 'send attempt',
			data: { recipientId: recipient.id, status: sendResult.status },
		})
	}

	const baseRunAt = withinReminderWindow ? nextScheduledAt : reminderWindowStart
	const nextRunAt = retryAt && retryAt < baseRunAt ? retryAt : baseRunAt
	logDebug({
		hypothesisId: 'H6',
		location: 'cron.server.ts:processRecipientJob',
		message: 'job rescheduled',
		data: {
			recipientId: recipient.id,
			nextRunAt: nextRunAt.toISOString(),
			baseRunAt: baseRunAt.toISOString(),
			retryAt: retryAt ? retryAt.toISOString() : null,
		},
	})
	await prisma.recipientJob.update({
		where: { id: job.id },
		data: { runAt: nextRunAt },
	})

	return { reminderSent, dueSent }
}

export function getSendTime(
	scheduleCron: string,
	options: { tz: string },
	number: number,
) {
	const interval = parseCronExpression(scheduleCron, options)
	let next = interval.next().toDate()
	while (number-- > 0) next = interval.next().toDate()
	return next
}

export function getNextScheduledTime(scheduleCron: string, timeZone: string) {
	const interval = parseCronExpression(scheduleCron, { tz: timeZone })
	return interval.next().toDate()
}

export function formatSendTime(date: Date, timezone: string): string {
	const options: Intl.DateTimeFormatOptions = {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
		timeZone: timezone,
		timeZoneName: 'short',
	}

	return new Intl.DateTimeFormat('en-US', options).format(date)
}
