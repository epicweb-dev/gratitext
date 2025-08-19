import { type Password, type User } from '@prisma/client'
import { redirect } from '@remix-run/node'
import bcrypt from 'bcryptjs'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { prisma } from './db.server.ts'
import { combineHeaders } from './misc.tsx'
import { authSessionStorage } from './session.server.ts'

// Session expiration constants
export const SESSION_IDLE_TIMEOUT = 1000 * 60 * 60 * 24 * 14 // 14 days
export const SESSION_ABSOLUTE_MAX_LIFETIME = 1000 * 60 * 60 * 24 * 90 // 90 days

export const getSessionExpirationDate = (isRenewal = false) => {
	if (isRenewal) {
		// For renewals, extend by idle timeout
		return new Date(Date.now() + SESSION_IDLE_TIMEOUT)
	} else {
		// For new sessions, use absolute max lifetime
		return new Date(Date.now() + SESSION_ABSOLUTE_MAX_LIFETIME)
	}
}

export const sessionKey = 'sessionId'

export async function getUserId(request: Request) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	if (!sessionId) return null

	const session = await prisma.session.findUnique({
		select: {
			id: true,
			expirationDate: true,
			createdAt: true,
			user: { select: { id: true } },
		},
		where: { id: sessionId, expirationDate: { gt: new Date() } },
	})

	if (!session?.user) {
		throw redirect('/', {
			headers: {
				'set-cookie': await authSessionStorage.destroySession(authSession),
			},
		})
	}

	// Check if session needs renewal (within 7 days of expiration)
	const sevenDaysFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
	const needsRenewal = session.expirationDate < sevenDaysFromNow

	// Check if session has reached absolute max lifetime
	const absoluteMaxExpiration = new Date(
		session.createdAt.getTime() + SESSION_ABSOLUTE_MAX_LIFETIME,
	)
	const hasReachedMaxLifetime = new Date() >= absoluteMaxExpiration

	if (hasReachedMaxLifetime) {
		// Session has reached absolute max lifetime, force logout
		await prisma.session.delete({ where: { id: sessionId } })
		throw redirect('/', {
			headers: {
				'set-cookie': await authSessionStorage.destroySession(authSession),
			},
		})
	}

	if (needsRenewal) {
		// Create new session with rotated ID and extended expiration
		const newSession = await prisma.session.create({
			data: {
				expirationDate: getSessionExpirationDate(true), // true = renewal
				userId: session.user.id,
			},
		})

		// Update the session in the cookie
		authSession.set(sessionKey, newSession.id)

		// Delete the old session
		await prisma.session.delete({ where: { id: sessionId } })

		// Store the new session info for entry.server.tsx to handle
		;(request as any).sessionRenewal = {
			sessionId: newSession.id,
			expirationDate: newSession.expirationDate,
		}
	}

	return session.user.id
}

export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const userId = await getUserId(request)
	if (!userId) {
		const requestUrl = new URL(request.url)
		redirectTo =
			redirectTo === null
				? null
				: (redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`)
		const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
		const loginRedirect = ['/login', loginParams?.toString()]
			.filter(Boolean)
			.join('?')
		throw redirect(loginRedirect)
	}
	return userId
}

export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)
	if (userId) {
		throw redirect('/')
	}
}

export async function login({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const user = await verifyUserPassword({ username }, password)
	if (!user) return null
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(false), // false = new session
			userId: user.id,
		},
	})
	return session
}

export async function resetUserPassword({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)
	return prisma.user.update({
		where: { username },
		data: {
			password: {
				update: {
					hash: hashedPassword,
				},
			},
		},
	})
}

export async function signup({
	phoneNumber,
	username,
	password,
	name,
}: {
	phoneNumber: User['phoneNumber']
	username: User['username']
	name: User['name']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)

	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(false), // false = new session
			user: {
				create: {
					phoneNumber: phoneNumber,
					username: username.toLowerCase(),
					name,
					roles: { connect: { name: 'user' } },
					password: {
						create: {
							hash: hashedPassword,
						},
					},
				},
			},
		},
		select: { id: true, expirationDate: true },
	})

	return session
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	// if this fails, we still need to delete the session from the user's browser
	// and it doesn't do any harm staying in the db anyway.
	if (sessionId) {
		// the .catch is important because that's what triggers the query.
		// learn more about PrismaPromise: https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismapromise-behavior
		void prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {})
	}
	throw redirect(safeRedirect(redirectTo), {
		...responseInit,
		headers: combineHeaders(
			{ 'set-cookie': await authSessionStorage.destroySession(authSession) },
			responseInit?.headers,
		),
	})
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: { id: true, password: { select: { hash: true } } },
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}
