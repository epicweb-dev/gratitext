import path from 'node:path'
import { fileURLToPath } from 'node:url'
import filenamify from 'filenamify'
import fsExtra from 'fs-extra'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirPath = path.join(__dirname, '..', 'fixtures')

export async function readFixture(subdir: string, name: string) {
	return fsExtra.readJSON(path.join(fixturesDirPath, subdir, `${name}.json`))
}

export async function createFixture(
	subdir: string,
	name: string,
	data: unknown,
) {
	const dir = path.join(fixturesDirPath, subdir)
	await fsExtra.ensureDir(dir)
	return fsExtra.writeJSON(path.join(dir, `./${name}.json`), data)
}

export const TextMessageSchema = z.object({
	To: z.string(),
	From: z.string(),
	Body: z.string(),
})

export async function writeText(rawText: unknown) {
	const textMessage = TextMessageSchema.parse(rawText)
	await createFixture('texts', filenamify(textMessage.To), textMessage)
	return textMessage
}

export async function requireText(recipient: string) {
	const textMessage = await readText(recipient)
	if (!textMessage) throw new Error(`Text message to ${recipient} not found`)
	return textMessage
}

export async function readText(recipient: string) {
	try {
		const textMessage = await readFixture('texts', filenamify(recipient))
		return TextMessageSchema.parse(textMessage)
	} catch {
		return null
	}
}

export async function waitForText(
	recipient: string,
	options: Parameters<typeof waitFor>[1] = {},
) {
	return waitFor(() => requireText(recipient), options)
}

/**
 * This allows you to wait for something (like a text to be available).
 *
 * It calls the callback every 50ms until it returns a value (and does not throw
 * an error). After the timeout, it will throw the last error that was thrown or
 * throw the error message provided as a fallback
 */
export async function waitFor<ReturnValue>(
	cb: () => ReturnValue | Promise<ReturnValue>,
	{
		errorMessage = 'waitFor call timed out',
		timeout = 5000,
	}: { errorMessage?: string; timeout?: number } = {},
) {
	const endTime = Date.now() + timeout
	let lastError: unknown = new Error(errorMessage)
	while (Date.now() < endTime) {
		try {
			const response = await cb()
			if (response) return response
		} catch (e: unknown) {
			lastError = e
		}
		await new Promise((r) => setTimeout(r, 100))
	}
	throw lastError
}

export function requireHeader(headers: Headers, header: string) {
	if (!headers.has(header)) {
		const headersString = JSON.stringify(
			Object.fromEntries(headers.entries()),
			null,
			2,
		)
		throw new Error(
			`Header "${header}" required, but not found in ${headersString}`,
		)
	}
	return headers.get(header)
}
