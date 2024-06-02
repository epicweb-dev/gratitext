/*
 * This entire file should be swapped for something more official.
 * Probably inngest... But we're gonna stick with this for now and see how far
 * it gets us.
 */
import { remember } from '@epic-web/remember'
import cronParser from 'cron-parser'
import {
	setIntervalAsync,
	clearIntervalAsync,
} from 'set-interval-async/dynamic'
import { prisma } from './db.server.ts'
import { sendText, sendTextToRecipient } from './text.server.ts'

const cronIntervalRef = remember<{
	current: ReturnType<typeof setIntervalAsync> | null
}>('cronInterval', () => ({ current: null }))

export function init() {
	console.log('initializing cron interval')
	if (cronIntervalRef.current) clearIntervalAsync(cronIntervalRef.current)

	cronIntervalRef.current = setIntervalAsync(
		() => sendNextTexts().catch(err => console.error(err)),
		1000 * 5,
	)
}

export async function sendNextTexts() {
	const recipients = await prisma.recipient.findMany({
		where: { verified: true },
		select: {
			id: true,
			name: true,
			scheduleCron: true,
			lastRemindedAt: true,
			messages: { orderBy: { sentAt: 'desc' }, take: 1 },
			user: {
				select: { phoneNumber: true, name: true },
			},
		},
	})

	const messagesToSend = recipients
		.map(recipient => {
			const { scheduleCron, messages, lastRemindedAt } = recipient
			const lastMessage = messages[0]
			const interval = cronParser.parseExpression(scheduleCron)
			const lastSent = new Date(lastMessage?.sentAt ?? 0)
			const prev = interval.prev().toDate()
			const next = interval.next().toDate()
			const nextIsSoon = next.getTime() - Date.now() < 1000 * 60 * 10
			const due = lastSent < prev
			const remind =
				nextIsSoon && (lastRemindedAt?.getTime() ?? 0) < prev.getTime()

			return {
				recipient,
				due,
				remind,
				prev,
			}
		})
		.filter(r => r.due || r.remind)

	if (!messagesToSend.length) return

	let dueSentCount = 0
	let reminderSentCount = 0
	for (const { recipient, due, remind, prev } of messagesToSend) {
		const nextMessage = await prisma.message.findFirst({
			select: { id: true, content: true, updatedAt: true },
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
				message: nextMessage.content,
			})
			await prisma.message.update({
				select: { id: true },
				where: { id: nextMessage.id },
				data: { sentAt: new Date() },
			})
			dueSentCount++
		}
	}

	if (reminderSentCount) console.log(`Sent ${reminderSentCount} reminders`)
	if (dueSentCount) console.log(`Sent ${dueSentCount} due texts`)
}
