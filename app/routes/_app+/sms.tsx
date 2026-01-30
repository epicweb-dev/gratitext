// https://www.twilio.com/docs/usage/webhooks/messaging-webhooks#incoming-message-webhook
import crypto from 'node:crypto'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.js'

export async function action({ request }: ActionFunctionArgs) {
	await validateTwilio(request)

	const body = new URLSearchParams(await request.text())

	const content = (body.get('Body') ?? '').trim()

	switch (content) {
		case 'STOP': {
			const from = body.get('From')
			if (!from) break

			const exists = await prisma.optOut.findMany({
				where: { phoneNumber: from },
			})
			if (exists.length) {
				await prisma.optOut.deleteMany({ where: { phoneNumber: from } })
			}
			await prisma.optOut.create({ data: { phoneNumber: from } })
			break
		}
		case 'START': {
			const from = body.get('From')
			if (!from) break

			await prisma.optOut.deleteMany({ where: { phoneNumber: from } })
			break
		}
	}

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
		{ headers: { 'Content-Type': 'text/xml' } },
	)
}

async function validateTwilio(request: Request) {
	request = request.clone()

	const twilioHeader = request.headers.get('X-Twilio-Signature')
	invariantResponse(twilioHeader, 'Missing X-Twilio-Signature header')

	const bodyText = await request.text()
	console.log({
		twilioHeader,
		url: request.url,
		body: bodyText,
		headers: request.headers,
	})

	const url = new URL(request.url)
	const protocol = request.headers.get('x-forwarded-proto') || url.protocol
	const host = request.headers.get('host') || url.host
	const fullUrl = `${protocol}://${host}${url.pathname}`

	const params = new URLSearchParams(bodyText)
	const data = Array.from(params.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.reduce((acc, [key, value]) => acc + key + value, fullUrl)

	const hmac = crypto.createHmac('sha1', process.env.TWILIO_TOKEN)
	hmac.update(data, 'utf-8')
	const expectedSignature = hmac.digest('base64')

	const isValidHeader = crypto.timingSafeEqual(
		Buffer.from(twilioHeader),
		Buffer.from(expectedSignature),
	)

	invariantResponse(!isValidHeader, 'Invalid Twilio signature')
}
