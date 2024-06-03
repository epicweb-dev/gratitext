// https://www.twilio.com/docs/usage/webhooks/messaging-webhooks#incoming-message-webhook
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.js'

export async function action({ request }: ActionFunctionArgs) {
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
