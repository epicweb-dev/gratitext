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

	cronIntervalRef.current = setIntervalAsync(sendNextTexts, 1000 * 5)
}

async function sendNextTexts() {
	const recipients = await prisma.recipient.findMany({
		where: { verified: true },
		select: {
			id: true,
			name: true,
			scheduleCron: true,
			messages: { orderBy: { sentAt: 'desc' }, take: 1 },
			user: {
				select: { phoneNumber: true, name: true },
			},
		},
	})

	const recipientsDue = recipients.filter(r => {
		const { scheduleCron } = r
		const { messages } = r
		const lastMessage = messages[0]
		if (!lastMessage) return false
		const interval = cronParser.parseExpression(scheduleCron)
		const lastSent = new Date(lastMessage.sentAt ?? 0)
		const prev = interval.prev().toDate()
		return lastSent < prev
	})

	if (!recipientsDue.length) return

	console.log(`Sending texts to ${recipientsDue.length} recipients`)

	for (const recipient of recipientsDue) {
		const nextMessage = await prisma.message.findFirst({
			select: { id: true, content: true },
			where: { recipientId: recipient.id, sentAt: null },
			orderBy: { order: 'asc' },
		})
		if (nextMessage) {
			await sendTextToRecipient({
				recipientId: recipient.id,
				message: nextMessage.content,
			})
			await prisma.message.update({
				select: { id: true },
				where: { id: nextMessage.id },
				data: { sentAt: new Date() },
			})
		} else {
			await sendText({
				to: recipient.user.phoneNumber,
				// TODO: don't hardcode the domain somehow...
				message: `Hello ${recipient.user.name}, you forgot to set up a message for ${recipient.name}.\n\nAdd one here: https://www.gratitext.app/recipients/${recipient.id}`,
			})
		}
	}
}
