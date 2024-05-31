import { faker } from '@faker-js/faker'
import { HttpResponse, http, type HttpHandler } from 'msw'
import { requireHeader, writeText } from './utils.ts'

const { TWILIO_ACCOUNT_SID } = process.env

const { json } = HttpResponse

export const handlers: Array<HttpHandler> = [
	http.post(
		`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
		async ({ request }) => {
			requireHeader(request.headers, 'Authorization')
			const body = Object.fromEntries(await request.formData())
			console.info('🔶 mocked text contents:', body)

			await writeText(body)

			return json({
				sid: faker.string.uuid(),
				status: 'queued',
				error_code: null,
				error_message: null,
			})
		},
	),
]
