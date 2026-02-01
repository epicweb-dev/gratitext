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
import { getRecipientsForCron } from '#app/utils/prisma-generated.server/sql/getRecipientsForCron'
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

function parseCronExpression(cronString: string, options?: { tz?: string }) {
	try {
		return CronExpressionParser.parse(cronString, options)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Invalid cron string'
		throw new CronParseError(errorMessage, cronString)
	}
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

export async function sendNextTexts() {
	const rawRecipients = await prisma.$queryRawTyped(getRecipientsForCron())

	type RawRecipient = getRecipientsForCron.Result
	type ReadyRecipient = RawRecipient & {
		id: string
		name: string
		scheduleCron: string
		timeZone: string
		userPhoneNumber: string
	}

	const recipients = rawRecipients
		.filter((recipient): recipient is ReadyRecipient =>
			Boolean(
				recipient.id &&
					recipient.name &&
					recipient.scheduleCron &&
					recipient.timeZone &&
					recipient.userPhoneNumber,
			),
		)
		.map((recipient) => ({
			id: recipient.id,
			name: recipient.name,
			scheduleCron: recipient.scheduleCron,
			timeZone: recipient.timeZone,
			lastRemindedAt: recipient.lastRemindedAt,
			lastSentAt: recipient.lastSentAt,
			user: {
				phoneNumber: recipient.userPhoneNumber,
				name: recipient.userName,
			},
		}))

	const messagesToSend = recipients
		.map((recipient) => {
			const { scheduleCron, lastRemindedAt, lastSentAt } = recipient
			try {
				const interval = parseCronExpression(scheduleCron, {
					tz: recipient.timeZone,
				})
				const lastSent = new Date(lastSentAt?.getTime() ?? 0)
				const prev = interval.prev().toDate()
				const next = interval.next().toDate()
				const nextIsSoon = next.getTime() - Date.now() < 1000 * 60 * 30
				const due = lastSent < prev
				const remind =
					nextIsSoon && (lastRemindedAt?.getTime() ?? 0) < prev.getTime()

				return {
					recipient,
					due,
					remind,
					prev,
				}
			} catch (error) {
				console.error(
					`Invalid cron string "${scheduleCron}" for recipient ${recipient.id}:`,
					error instanceof Error ? error.message : error,
				)
				return null
			}
		})
		.filter(
			(r): r is NonNullable<typeof r> => r !== null && (r.due || r.remind),
		)

	if (!messagesToSend.length) return

	let dueSentCount = 0
	let reminderSentCount = 0
	for (const { recipient, due, remind, prev } of messagesToSend) {
		const nextMessage = await prisma.message.findFirst({
			select: { id: true, updatedAt: true },
			where: { recipientId: recipient.id, sentAt: null },
			orderBy: { order: 'asc' },
		})

		if (!nextMessage && remind) {
			await sendText({
				to: recipient.user.phoneNumber,
				// TODO: don't hardcode the domain somehow...
				message: `Hello ${recipient.user.name}, you forgot to set up a message for ${recipient.name} and the sending time is coming up.\n\nAdd a thoughtful personal message here: https://www.gratitext.app/recipients/${recipient.id}`,
			})
			await prisma.recipient.update({
				where: { id: recipient.id },
				data: { lastRemindedAt: new Date() },
			})
			reminderSentCount++
		}

		// if the message was last updated after the previous time to send then it's
		// overdue and we don't send it automatically
		const overDueTimeMs = Date.now() - prev.getTime()
		const tooLongOverdue = overDueTimeMs > 1000 * 60 * 10
		const nextMessageWasReady = nextMessage
			? nextMessage.updatedAt < prev
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
