import { z } from 'zod'
import { prisma } from './db.server.ts'

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

	if (process.env.DISABLE_TEXTS === 'true') {
		return {
			status: 'error',
			error: 'Texts are disabled... Stay tuned!',
		}
	}

	// TODO: maybe we'll have more of these in the future?
	const sourceNumber = await prisma.sourceNumber.findFirst({
		select: { phoneNumber: true },
	})

	if (!sourceNumber) {
		throw new Error('No source number found')
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
