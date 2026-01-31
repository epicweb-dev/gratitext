import { faker } from '@faker-js/faker'
import bcrypt from 'bcryptjs'
import { UniqueEnforcer } from 'enforce-unique'
import { type PrismaClient } from '#app/utils/prisma-generated.server/client.ts'

const uniqueUsernameEnforcer = new UniqueEnforcer()
const uniquePhoneEnforcer = new UniqueEnforcer()

export function createPhoneNumber() {
	return uniquePhoneEnforcer.enforce(() => {
		const digits = faker.string.numeric({ length: 10, allowLeadingZeros: true })
		return `+1${digits}`
	})
}

export function createUser() {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()

	const username = uniqueUsernameEnforcer
		.enforce(() => {
			return (
				faker.string.alphanumeric({ length: 2 }) +
				'_' +
				faker.internet.username({
					firstName: firstName.toLowerCase(),
					lastName: lastName.toLowerCase(),
				})
			)
		})
		.slice(0, 20)
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')
	return {
		username,
		name: `${firstName} ${lastName}`,
		phoneNumber: createPhoneNumber(),
	}
}

export function createPassword(password: string = faker.internet.password()) {
	return {
		hash: bcrypt.hashSync(password, 10),
	}
}

export function createMessage() {
	const sentAt = Math.random() > 0.5 ? faker.date.recent() : undefined
	return {
		content: faker.lorem.sentence(),
		sentAt,
		twilioId: sentAt ? faker.string.uuid() : undefined,
		order: faker.number.float({ min: 0, max: 100, multipleOf: 0.0000000001 }),
	}
}

export function createRecipient() {
	return {
		phoneNumber: createPhoneNumber(),
		name: faker.person.fullName(),
		verified: faker.datatype.boolean(),
		// TODO: make sure this doesn't generate a cron string that's too frequent
		scheduleCron: faker.system.cron(),
		timeZone: 'America/Denver',
	}
}

export async function cleanupDb(prisma: PrismaClient) {
	const tables = await prisma.$queryRaw<
		{ name: string }[]
	>`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`

	try {
		// Disable FK constraints to avoid relation conflicts during deletion
		await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`)
		await prisma.$transaction([
			// Delete all rows from each table, preserving table structures
			...tables.map(({ name }) =>
				prisma.$executeRawUnsafe(`DELETE from "${name}"`),
			),
		])
	} catch (error) {
		console.error('Error cleaning up database:', error)
	} finally {
		await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`)
	}
}
