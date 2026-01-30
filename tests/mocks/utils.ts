import path from 'node:path'
import { fileURLToPath } from 'node:url'
import filenamify from 'filenamify'
import fsExtra from 'fs-extra'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirPath = path.join(__dirname, '..', 'fixtures')

const DEFAULT_RETRY_OPTIONS = {
	attempts: 20,
	delayMs: 300,
}

/**
 * Read a fixture file with retry logic for async writes (e.g. background email/sms).
 * Retries with delay to allow async processes to finish writing.
 */
export async function readFixture(
	subdir: string,
	name: string,
	options: { attempts?: number; delayMs?: number } = {},
) {
	const { attempts, delayMs } = { ...DEFAULT_RETRY_OPTIONS, ...options }
	const filePath = path.join(fixturesDirPath, subdir, `${name}.json`)
	let lastError: unknown
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fsExtra.readJSON(filePath)
		} catch (e) {
			lastError = e
			if (attempt < attempts) {
				await new Promise((r) => setTimeout(r, delayMs))
			}
		}
	}
	throw lastError
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

/**
 * Delete a fixture file if it exists
 */
export async function deleteFixture(subdir: string, name: string) {
	const filePath = path.join(fixturesDirPath, subdir, `${name}.json`)
	try {
		await fsExtra.remove(filePath)
	} catch {
		// Ignore errors if file doesn't exist
	}
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

/**
 * Delete a text fixture for a recipient
 */
export async function deleteText(recipient: string) {
	await deleteFixture('texts', filenamify(recipient))
}

export async function requireText(
	recipient: string,
	options: { attempts?: number; delayMs?: number } = {},
) {
	const textMessage = await readText(recipient, options)
	if (!textMessage) throw new Error(`Text message to ${recipient} not found`)
	return textMessage
}

export async function readText(
	recipient: string,
	options: { attempts?: number; delayMs?: number } = {},
) {
	try {
		const textMessage = await readFixture(
			'texts',
			filenamify(recipient),
			options,
		)
		return TextMessageSchema.parse(textMessage)
	} catch {
		return null
	}
}

/**
 * Wait for a text message to be available for a recipient.
 * Increased default timeout and retry frequency for better reliability.
 */
export async function waitForText(
	recipient: string,
	options: Parameters<typeof waitFor>[1] = {},
) {
	// Use increased timeout for waiting for text messages
	const mergedOptions = {
		timeout: 15000,
		errorMessage: `Text message to ${recipient} not found within timeout`,
		...options,
	}
	return waitFor(
		() => requireText(recipient, { attempts: 1, delayMs: 0 }),
		mergedOptions,
	)
}

/**
 * This allows you to wait for something (like a text to be available).
 *
 * It calls the callback every 150ms until it returns a value (and does not throw
 * an error). After the timeout, it will throw the last error that was thrown or
 * throw the error message provided as a fallback
 */
export async function waitFor<ReturnValue>(
	cb: () => ReturnValue | Promise<ReturnValue>,
	{
		errorMessage = 'waitFor call timed out',
		timeout = 10000,
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
		// Increased polling interval for better balance between speed and reliability
		await new Promise((r) => setTimeout(r, 150))
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
