import { Honeypot, SpamError } from 'remix-utils/honeypot/server'

const shouldDisableValidFrom =
	process.env.NODE_ENV === 'test' || Boolean(process.env.PLAYWRIGHT_TEST_BASE_URL)

export const honeypot = new Honeypot({
	validFromFieldName: shouldDisableValidFrom ? null : undefined,
	encryptionSeed: process.env.HONEYPOT_SECRET,
})

export async function checkHoneypot(formData: FormData) {
	try {
		await honeypot.check(formData)
	} catch (error) {
		if (error instanceof SpamError) {
			throw new Response('Form not submitted properly', { status: 400 })
		}
		throw error
	}
}
