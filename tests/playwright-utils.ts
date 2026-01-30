import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base } from '@playwright/test'
import filenamify from 'filenamify'
import fsExtra from 'fs-extra'
import * as setCookieParser from 'set-cookie-parser'
import {
	getPasswordHash,
	getSessionExpirationDate,
	sessionKey,
} from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { type User as UserModel } from '#app/utils/prisma-generated.server/client.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { createUser } from './db-utils.ts'
import { waitFor } from './mocks/utils.ts'

export * from './db-utils.ts'
export { waitFor } from './mocks/utils.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirPath = path.join(__dirname, 'fixtures')

type GetOrInsertUserOptions = {
	id?: string
	username?: UserModel['username']
	password?: string
	phoneNumber?: UserModel['phoneNumber']
	stripeId?: string
}

type User = {
	id: string
	phoneNumber: string
	username: string
	name: string | null
}

/**
 * Retry a database operation with exponential backoff
 * Helps with transient database errors and race conditions
 */
async function retryDbOperation<T>(
	operation: () => Promise<T>,
	{ maxRetries = 3, baseDelayMs = 100 } = {},
): Promise<T> {
	let lastError: unknown
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await operation()
		} catch (error) {
			lastError = error
			if (attempt < maxRetries - 1) {
				await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
			}
		}
	}
	throw lastError
}

async function getOrInsertUser({
	id,
	username,
	password,
	phoneNumber,
	stripeId,
}: GetOrInsertUserOptions = {}): Promise<User> {
	const select = { id: true, phoneNumber: true, username: true, name: true }
	if (id) {
		return await retryDbOperation(() =>
			prisma.user.findUniqueOrThrow({
				select,
				where: { id: id },
			}),
		)
	} else {
		const userData = createUser()
		const finalUsername = username ?? userData.username
		const finalPassword = password ?? userData.username
		const finalPhoneNumber = phoneNumber ?? userData.phoneNumber
		// Hash password before db operation to avoid await in non-async context
		const passwordHash = await getPasswordHash(finalPassword)
		return await retryDbOperation(() =>
			prisma.user.create({
				select,
				data: {
					...userData,
					phoneNumber: finalPhoneNumber,
					username: finalUsername,
					stripeId,
					roles: { connect: { name: 'user' } },
					password: { create: { hash: passwordHash } },
				},
			}),
		)
	}
}

/**
 * Clean up fixtures for a specific phone number
 * Prevents stale data from previous test runs from affecting current tests
 */
async function cleanupFixturesForPhone(phoneNumber: string) {
	const textsDir = path.join(fixturesDirPath, 'texts')
	try {
		await fsExtra.ensureDir(textsDir)
		const files = await fsExtra.readdir(textsDir)
		// Use filenamify to match how fixtures are actually created
		const filenamePrefix = filenamify(phoneNumber)
		const targetFile = `${filenamePrefix}.json`
		for (const file of files) {
			if (file === targetFile) {
				await fsExtra.remove(path.join(textsDir, file))
			}
		}
	} catch {
		// Ignore cleanup errors
	}
}

export const test = base.extend<{
	insertNewUser(options?: GetOrInsertUserOptions): Promise<User>
	login(options?: GetOrInsertUserOptions): Promise<User>
}>({
	insertNewUser: async ({}, use) => {
		let userId: string | undefined = undefined
		let userPhoneNumber: string | undefined = undefined
		// eslint-disable-next-line react-hooks/rules-of-hooks
		await use(async (options) => {
			const user = await getOrInsertUser(options)
			userId = user.id
			userPhoneNumber = user.phoneNumber
			// Clean up any stale fixtures for this phone number
			await cleanupFixturesForPhone(user.phoneNumber)
			return user
		})
		await prisma.user.delete({ where: { id: userId } }).catch(() => {})
		// Clean up fixtures after test
		if (userPhoneNumber) {
			await cleanupFixturesForPhone(userPhoneNumber)
		}
	},
	login: async ({ page }, use) => {
		let userId: string | undefined = undefined
		let userPhoneNumber: string | undefined = undefined
		// eslint-disable-next-line react-hooks/rules-of-hooks
		await use(async (options) => {
			const user = await getOrInsertUser(options)
			userId = user.id
			userPhoneNumber = user.phoneNumber
			// Clean up any stale fixtures for this phone number
			await cleanupFixturesForPhone(user.phoneNumber)

			const session = await retryDbOperation(() =>
				prisma.session.create({
					data: {
						expirationDate: getSessionExpirationDate({ isRenewal: false }),
						userId: user.id,
					},
					select: { id: true },
				}),
			)

			const authSession = await authSessionStorage.getSession()
			authSession.set(sessionKey, session.id)
			const cookieConfig = setCookieParser.parseString(
				await authSessionStorage.commitSession(authSession),
			) as any
			await page
				.context()
				.addCookies([{ ...cookieConfig, domain: 'localhost' }])
			return user
		})
		await prisma.user.deleteMany({ where: { id: userId } })
		// Clean up fixtures after test
		if (userPhoneNumber) {
			await cleanupFixturesForPhone(userPhoneNumber)
		}
	},
})
export const { expect } = test
