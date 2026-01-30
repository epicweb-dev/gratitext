// @epic-web/totp should be used server-side only. It imports `Crypto` which results in Remix
// including a big polyfill. So we put the import in a `.server.ts` file to avoid that
import {
	generateTOTP as generateTOTPBase,
	getTOTPAuthUri as getTOTPAuthUriBase,
	verifyTOTP as verifyTOTPBase,
	type HashAlgorithm,
} from '@epic-web/totp'

type GenerateTOTPOptions = Parameters<typeof generateTOTPBase>[0]
type VerifyTOTPOptions = Parameters<typeof verifyTOTPBase>[0]
type TOTPAuthUriOptions = Parameters<typeof getTOTPAuthUriBase>[0]

const normalizeAlgorithm = (algorithm?: string) => {
	if (!algorithm) return algorithm
	const match = /^SHA-?(\d+)$/i.exec(algorithm.trim())
	if (!match) return algorithm
	return `SHA-${match[1]}`
}

const normalizeOptions = <T extends { algorithm?: string }>(options: T): T => {
	const normalizedAlgorithm = normalizeAlgorithm(options.algorithm)
	if (normalizedAlgorithm === options.algorithm) return options
	return { ...options, algorithm: normalizedAlgorithm }
}

export async function generateTOTP(options?: GenerateTOTPOptions) {
	return generateTOTPBase(options ? normalizeOptions(options) : options)
}

export async function verifyTOTP(options: VerifyTOTPOptions) {
	return verifyTOTPBase(normalizeOptions(options))
}

export function getTOTPAuthUri(options: TOTPAuthUriOptions) {
	return getTOTPAuthUriBase({
		...options,
		algorithm: normalizeAlgorithm(options.algorithm) as HashAlgorithm,
	})
}

export type { HashAlgorithm }
