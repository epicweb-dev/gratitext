import { z } from 'zod'
import { prisma } from './db.server.ts'
import { getCustomerProducts } from './stripe.server.ts'

const { TWILIO_SID, TWILIO_TOKEN } = process.env

const TwilioResponseSchema = z.union([
	z.object({
		sid: z.string(),
		status: z.enum([
			'queued',
			'sending',
			'sent',
			'delivered',
			'receiving',
			'received',
			'accepted',
			'scheduled',
			'read',
			'partially_delivered',
			'canceled',
		]),
		error_code: z.null(),
		error_message: z.null(),
	}),
	z.object({
		sid: z.string(),
		status: z.enum(['failed', 'undelivered']),
		error_code: z.number(),
		error_message: z.string(),
	}),
])

export async function sendTextToRecipient({
	recipientId,
	messageId,
}: {
	recipientId: string
	messageId: string
}): ReturnType<typeof sendText> {
	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId },
		select: {
			phoneNumber: true,
			verified: true,
			user: { select: { id: true, stripeId: true } },
		},
	})
	if (!recipient) {
		return { status: 'error', error: 'Recipient not found' }
	}
	if (!recipient.verified) {
		return { status: 'error', error: 'Recipient not verified' }
	}
	if (!recipient.user.stripeId) {
		return { status: 'error', error: 'Recipient has not subscribed' }
	}
	const products = await getCustomerProducts(recipient.user.stripeId)
	const messageCountInLastTwentyThreeHours = await prisma.message.count({
		where: {
			recipient: { userId: recipient.user.id },
			sentAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 23) },
		},
	})

	const isPremium = products.includes('premium')
	const limit = isPremium ? 10 : 1
	if (messageCountInLastTwentyThreeHours >= limit) {
		return {
			status: 'error',
			error: isPremium
				? `You have reached the premium limit of ${limit} in 24 hours.`
				: `You have reached the basic limit of ${limit} in 24 hours (upgrade for more).`,
		}
	}

	const message = await prisma.message.findUnique({
		where: { id: messageId },
		select: { content: true },
	})
	if (!message) {
		return { status: 'error', error: 'Message not found' }
	}

	const result = await sendText({
		to: recipient.phoneNumber,
		message: message.content,
	})
	if (result.status === 'success') {
		await prisma.message.update({
			select: { id: true },
			where: { id: messageId },
			data: { sentAt: new Date(), twilioId: result.data.sid },
		})
	}
	return result
}

export async function sendText({
	to,
	message,
}: {
	to: string
	message: string
}): Promise<
	| { status: 'success'; data: z.infer<typeof TwilioResponseSchema> }
	| { status: 'error'; error: string }
> {
	const optOut = await prisma.optOut.findFirst({
		where: { phoneNumber: to },
		select: { id: true },
	})
	if (optOut) {
		return {
			status: 'error',
			error: 'The destination phone number has opted out of all text messages',
		}
	}

	// TODO: maybe we'll have more of these in the future?
	const sourceNumber = await prisma.sourceNumber.findFirst({
		select: { phoneNumber: true },
	})

	if (!sourceNumber) {
		return { status: 'error', error: 'No source number found' }
	}

	const params = new URLSearchParams({
		To: to,
		From: sourceNumber.phoneNumber,
		Body: message,
	})
	const response = await fetch(
		`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
			},
			body: params.toString(),
		},
	)
	if (!response.ok) {
		return { status: 'error', error: await response.text() }
	}
	const json = await response.json()
	const parsed = TwilioResponseSchema.safeParse(json)
	if (parsed.success) {
		const { data } = parsed
		if (data.error_code) {
			return { status: 'error', error: data.error_message }
		} else {
			return { status: 'success', data }
		}
	} else {
		return { status: 'error', error: parsed.error.message }
	}
}
