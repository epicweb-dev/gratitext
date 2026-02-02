/*
 * This entire file should be swapped for something more official.
 * Probably inngest... But we're gonna stick with this for now and see how far
 * it gets us.
 */
import { remember } from '@epic-web/remember'
import { CronExpressionParser } from 'cron-parser'
import {
	clearIntervalAsync,
	setIntervalAsync,
} from 'set-interval-async/dynamic'
import { prisma } from './db.server.ts'
import { SCHEDULE_SENTINEL_DATE } from './schedule-constants.server.ts'
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

const cronIntervalRef = remember<{
	current: ReturnType<typeof setIntervalAsync> | null
}>('cronInterval', () => ({ current: null }))

export async function init() {
	console.log('initializing cron interval')
	if (cronIntervalRef.current) await clearIntervalAsync(cronIntervalRef.current)

	cronIntervalRef.current = setIntervalAsync(
		() => sendNextTexts().catch((err) => console.error(err)),
		1000 * 5,
	)
}

/**
 * Type for recipients returned from the optimized cron query
 */
type CronRecipient = {
	id: string
	name: string
	scheduleCron: string
	timeZone: string
	prevScheduledAt: Date | null
	nextScheduledAt: Date | null
	lastRemindedAt: Date | null
	lastSentAt: Date | null
	userPhoneNumber: string
	userName: string | null
}

export async function sendNextTexts() {
	const now = new Date()
	const reminderWindowMs = 1000 * 60 * 30
	const reminderCutoff = new Date(now.getTime() + reminderWindowMs)

	// Optimized raw SQL query that:
	// 1. Uses EXISTS instead of JOIN (we only filter by User, don't select from it)
	// 2. Uses the composite index on (verified, disabled, nextScheduledAt, userId)
	// 3. Handles both regular scheduled recipients and those with sentinel dates
	// Note: SCHEDULE_SENTINEL_DATE (9999-12-31) will always be > reminderCutoff,
	// so recipients with invalid schedules won't be included unless we explicitly fetch them
	const recipients = await prisma.$queryRaw<CronRecipient[]>`
		SELECT
			r.id,
			r.name,
			r.scheduleCron,
			r.timeZone,
			r.prevScheduledAt,
			r.nextScheduledAt,
			r.lastRemindedAt,
			r.lastSentAt,
			u.phoneNumber AS userPhoneNumber,
			u.name AS userName
		FROM Recipient r
		INNER JOIN User u ON u.id = r.userId
		WHERE r.verified = 1
			AND r.disabled = 0
			AND u.stripeId IS NOT NULL
			AND r.nextScheduledAt <= ${reminderCutoff}
		ORDER BY r.nextScheduledAt ASC
	`

	// Transform the raw result to match the expected format
	const formattedRecipients = recipients.map((r) => ({
		...r,
		user: {
			phoneNumber: r.userPhoneNumber,
			name: r.userName,
		},
	}))

	if (!formattedRecipients.length) return

	let dueSentCount = 0
	let reminderSentCount = 0
	for (const recipient of formattedRecipients) {
		let scheduleWindow: {
			prevScheduledAt: Date
			nextScheduledAt: Date
		}
		if (
			recipient.prevScheduledAt &&
			recipient.nextScheduledAt &&
			recipient.nextScheduledAt > now &&
			recipient.nextScheduledAt.getTime() !== SCHEDULE_SENTINEL_DATE.getTime()
		) {
			scheduleWindow = {
				prevScheduledAt: recipient.prevScheduledAt,
				nextScheduledAt: recipient.nextScheduledAt,
			}
		} else {
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
				// Update with sentinel to prevent repeated processing
				await prisma.recipient.update({
					where: { id: recipient.id },
					data: {
						prevScheduledAt: SCHEDULE_SENTINEL_DATE,
						nextScheduledAt: SCHEDULE_SENTINEL_DATE,
					},
				})
				continue
			}
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

		const lastSent = new Date(recipient.lastSentAt ?? 0)
		const nextIsSoon =
			nextScheduledAt.getTime() - now.getTime() < reminderWindowMs
		const due = lastSent < prevScheduledAt
		const remind =
			nextIsSoon &&
			new Date(recipient.lastRemindedAt ?? 0).getTime() <
				prevScheduledAt.getTime()

		if (!due && !remind) continue

		const nextMessage = await prisma.message.findFirst({
			select: { id: true, updatedAt: true },
			where: { recipientId: recipient.id, sentAt: null },
			orderBy: { order: 'asc' },
		})

		if (!nextMessage && remind) {
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
				reminderSentCount++
			}
		}

		// if the message was last updated after the previous time to send then it's
		// overdue and we don't send it automatically
		const overDueTimeMs = now.getTime() - prevScheduledAt.getTime()
		const tooLongOverdue = overDueTimeMs > 1000 * 60 * 10
		const nextMessageWasReady = nextMessage
			? nextMessage.updatedAt < prevScheduledAt
			: false

		if (nextMessage && due && nextMessageWasReady && !tooLongOverdue) {
			await sendTextToRecipient({
				recipientId: recipient.id,
				messageId: nextMessage.id,
			})
			dueSentCount++
		}
	}

	if (reminderSentCount) console.log(`Sent ${reminderSentCount} reminders`)
	if (dueSentCount) console.log(`Sent ${dueSentCount} due texts`)
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
