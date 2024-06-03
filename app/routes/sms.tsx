// https://www.twilio.com/docs/usage/webhooks/messaging-webhooks#incoming-message-webhook
import { type ActionFunctionArgs } from '@remix-run/node'

export async function action({ request }: ActionFunctionArgs) {
	const body = new URLSearchParams(await request.text())

	console.log(Object.fromEntries(body))

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
		{ headers: { 'Content-Type': 'text/xml' } },
	)
}
