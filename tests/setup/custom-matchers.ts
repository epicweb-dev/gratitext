import { expect } from 'bun:test'
import * as setCookieParser from 'set-cookie-parser'
import { sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import {
	type ToastInput,
	toastSessionStorage,
	toastKey,
} from '#app/utils/toast.server.ts'
import { convertSetCookieToCookie } from '#tests/utils.ts'

expect.extend({
	toHaveRedirect(actual: unknown, redirectTo?: string | null) {
		if (!(actual instanceof Response)) {
			return {
				pass: false,
				message: () =>
					`Expected a Response but received ${this.utils.printReceived(
						actual,
					)}`,
			}
		}
		const response = actual
		const location = response.headers.get('location')
		const redirectToSupplied = redirectTo !== undefined
		if (redirectToSupplied !== Boolean(location)) {
			return {
				pass: Boolean(location),
				message: () =>
					`Expected response to ${this.isNot ? 'not ' : ''}redirect${
						redirectToSupplied
							? ` to ${this.utils.printExpected(redirectTo)}`
							: ''
					} but got ${
						location ? 'no redirect' : this.utils.printReceived(location)
					}`,
			}
		}
		const isRedirectStatusCode = response.status >= 300 && response.status < 400
		if (!isRedirectStatusCode) {
			return {
				pass: false,
				message: () =>
					`Expected redirect to ${
						this.isNot ? 'not ' : ''
					}be ${this.utils.printExpected(
						'>= 300 && < 400',
					)} but got ${this.utils.printReceived(response.status)}`,
			}
		}

		function toUrl(s?: string | null) {
			s ??= ''
			return s.startsWith('http')
				? new URL(s)
				: new URL(s, 'https://example.com')
		}

		function urlsMatch(u1: URL, u2: URL) {
			const u1SP = new URL(u1).searchParams
			u1SP.sort()
			const u2SP = new URL(u2).searchParams
			u2SP.sort()
			return (
				u1.origin === u2.origin &&
				u1.pathname === u2.pathname &&
				u1SP.toString() === u2SP.toString() &&
				u1.hash === u2.hash
			)
		}

		return {
			pass:
				location == redirectTo || urlsMatch(toUrl(location), toUrl(redirectTo)),
			message: () =>
				`Expected response to ${
					this.isNot ? 'not ' : ''
				}redirect to ${this.utils.printExpected(
					redirectTo,
				)} but got ${this.utils.printReceived(location)}`,
		}
	},
	async toHaveSessionForUser(actual: unknown, userId: string) {
		if (!(actual instanceof Response)) {
			return {
				pass: false,
				message: () =>
					`Expected a Response but received ${this.utils.printReceived(
						actual,
					)}`,
			}
		}
		const response = actual
		const setCookies = getSetCookie(response.headers)
		const sessionSetCookie = setCookies.find(
			(c) => setCookieParser.parseString(c).name === 'en_session',
		)

		if (!sessionSetCookie) {
			return {
				pass: false,
				message: () =>
					`The en_session set-cookie header was${
						this.isNot ? '' : ' not'
					} defined`,
			}
		}

		const authSession = await authSessionStorage.getSession(
			convertSetCookieToCookie(sessionSetCookie),
		)
		const sessionValue = authSession.get(sessionKey)

		if (!sessionValue) {
			return {
				pass: false,
				message: () => `A session was${this.isNot ? '' : ' not'} set in cookie`,
			}
		}

		const session = await prisma.session.findUnique({
			select: { id: true },
			where: { userId, id: sessionValue },
		})

		return {
			pass: Boolean(session),
			message: () =>
				`A session was${
					this.isNot ? ' not' : ''
				} created in the database for ${userId}`,
		}
	},
	async toSendToast(actual: unknown, toast: ToastInput) {
		if (!(actual instanceof Response)) {
			return {
				pass: false,
				message: () =>
					`Expected a Response but received ${this.utils.printReceived(
						actual,
					)}`,
			}
		}
		const response = actual
		const setCookies = getSetCookie(response.headers)
		const toastSetCookie = setCookies.find(
			(c) => setCookieParser.parseString(c).name === 'en_toast',
		)

		if (!toastSetCookie) {
			return {
				pass: false,
				message: () =>
					`en_toast set-cookie header was${this.isNot ? '' : ' not'} defined`,
			}
		}

		const toastSession = await toastSessionStorage.getSession(
			convertSetCookieToCookie(toastSetCookie),
		)
		const toastValue = toastSession.get(toastKey)

		if (!toastValue) {
			return {
				pass: false,
				message: () => `toast was${this.isNot ? '' : ' not'} set in session`,
			}
		}

		const pass = this.equals(toastValue, toast)

		return {
			pass,
			message: () =>
				`toast in the response ${
					this.isNot ? 'does not match' : 'matches'
				} the expected toast`,
		}
	},
})

interface CustomMatchers {
	toHaveRedirect(redirectTo?: string | null): void
	toHaveSessionForUser(userId: string): Promise<void>
	toSendToast(toast: ToastInput): Promise<void>
}

declare module 'bun:test' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface Matchers<T = unknown> extends CustomMatchers {}
	interface AsymmetricMatchers extends CustomMatchers {}
}

function getSetCookie(headers: Headers) {
	// this is a sort of polyfill for headers.getSetCookie
	// https://github.com/microsoft/TypeScript/issues/55270
	// https://github.com/remix-run/remix/issues/7067
	return headers.getAll('set-cookie') as Array<string>
}
