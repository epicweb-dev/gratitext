import 'dotenv/config'
import { performance } from 'node:perf_hooks'
import { parseArgs } from 'node:util'
import { faker } from '@faker-js/faker'
import { createId } from '@paralleldrive/cuid2'
import bcrypt from 'bcryptjs'
import { getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { type Prisma } from '#app/utils/prisma-generated.server/client.ts'

type SeedOptions = {
	users: number
	recipientsPerUser: number
	messagesPerRecipient: number
	sentRatio: number
	messageBatchSize: number
	reset: boolean
	seed: number | null
}

const defaultOptions: SeedOptions = {
	users: 40,
	recipientsPerUser: 25,
	messagesPerRecipient: 200,
	sentRatio: 0.7,
	messageBatchSize: 1000,
	reset: false,
	seed: null,
}

const cronSchedules = [
	'0 0 9 * * 1-5',
	'0 30 12 * * *',
	'0 15 18 * * 1-5',
	'0 0 8 * * 0',
	'0 45 20 * * 1-5',
]

const timeZones = [
	'America/Denver',
	'America/New_York',
	'America/Chicago',
	'Europe/London',
]

const usedUsernames = new Set<string>()
const usedPhoneNumbers = new Set<string>()

function createPhoneNumber() {
	let phoneNumber = ''
	do {
		const digits = faker.string.numeric({ length: 10, allowLeadingZeros: true })
		phoneNumber = `+1${digits}`
	} while (usedPhoneNumbers.has(phoneNumber))
	usedPhoneNumbers.add(phoneNumber)
	return phoneNumber
}

function createUser() {
	let username = ''
	do {
		username = `user_${createId()}`
			.slice(0, 20)
			.toLowerCase()
			.replace(/[^a-z0-9_]/g, '_')
	} while (usedUsernames.has(username))
	usedUsernames.add(username)

	return {
		username,
		name: faker.person.fullName(),
		phoneNumber: createPhoneNumber(),
	}
}

function createPassword(password: string) {
	return {
		hash: bcrypt.hashSync(password, 10),
	}
}

async function cleanupDb() {
	const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
		`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`,
	)

	try {
		await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`)
		await prisma.$transaction(
			tables.map(({ name }) =>
				prisma.$executeRawUnsafe(`DELETE from "${name}"`),
			),
		)
	} finally {
		await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`)
	}
}

function parseNumber(value: unknown, fallback: number, name: string) {
	if (value === undefined || value === null || value === '') return fallback
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid ${name}: ${value}`)
	}
	return parsed
}

function parseOptions(): SeedOptions {
	const { values } = parseArgs({
		options: {
			users: { type: 'string', short: 'u' },
			'recipients-per-user': { type: 'string' },
			'messages-per-recipient': { type: 'string' },
			'sent-ratio': { type: 'string' },
			'message-batch-size': { type: 'string' },
			reset: { type: 'boolean', short: 'r' },
			seed: { type: 'string' },
		},
		allowPositionals: true,
	})

	const users = parseNumber(
		values.users ?? process.env.BENCH_USERS,
		defaultOptions.users,
		'users',
	)
	const recipientsPerUser = parseNumber(
		values['recipients-per-user'] ?? process.env.BENCH_RECIPIENTS_PER_USER,
		defaultOptions.recipientsPerUser,
		'recipients-per-user',
	)
	const messagesPerRecipient = parseNumber(
		values['messages-per-recipient'] ??
			process.env.BENCH_MESSAGES_PER_RECIPIENT,
		defaultOptions.messagesPerRecipient,
		'messages-per-recipient',
	)
	const sentRatio = parseNumber(
		values['sent-ratio'] ?? process.env.BENCH_SENT_RATIO,
		defaultOptions.sentRatio,
		'sent-ratio',
	)
	const messageBatchSize = parseNumber(
		values['message-batch-size'] ?? process.env.BENCH_MESSAGE_BATCH_SIZE,
		defaultOptions.messageBatchSize,
		'message-batch-size',
	)
	const seedValue = parseNumber(
		values.seed ?? process.env.BENCH_SEED,
		NaN,
		'seed',
	)

	return {
		users: Math.max(0, Math.floor(users)),
		recipientsPerUser: Math.max(0, Math.floor(recipientsPerUser)),
		messagesPerRecipient: Math.max(0, Math.floor(messagesPerRecipient)),
		sentRatio: Math.min(1, Math.max(0, sentRatio)),
		messageBatchSize: Math.max(1, Math.floor(messageBatchSize)),
		reset: values.reset ?? false,
		seed: Number.isFinite(seedValue) ? seedValue : null,
	}
}

async function ensurePermissions() {
	const count = await prisma.permission.count()
	if (count > 0) return

	const entities = ['user', 'recipient', 'message']
	const actions = ['create', 'read', 'update', 'delete']
	const accesses = ['own', 'any'] as const
	const data: Array<{ entity: string; action: string; access: 'own' | 'any' }> =
		[]

	for (const entity of entities) {
		for (const action of actions) {
			for (const access of accesses) {
				data.push({ entity, action, access })
			}
		}
	}

	await prisma.permission.createMany({ data })
}

async function ensureRoles() {
	const userRole = await prisma.role.findUnique({ where: { name: 'user' } })
	const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } })

	if (!userRole) {
		await prisma.role.create({
			data: {
				name: 'user',
				permissions: {
					connect: await prisma.permission.findMany({
						select: { id: true },
						where: { access: 'own' },
					}),
				},
			},
		})
	}

	if (!adminRole) {
		await prisma.role.create({
			data: {
				name: 'admin',
				permissions: {
					connect: await prisma.permission.findMany({
						select: { id: true },
						where: { access: 'any' },
					}),
				},
			},
		})
	}
}

async function ensureSourceNumber() {
	const existing = await prisma.sourceNumber.findFirst({
		select: { id: true },
	})
	if (existing) return

	await prisma.sourceNumber.create({
		data: { phoneNumber: '555-555-5555' },
	})
}

function buildMessageContent(index: number) {
	const messages = [
		'Thanks for being awesome.',
		'Thinking of you today.',
		'You make the world better.',
		'Grateful for your kindness.',
		'Hope you are doing well.',
	]
	return `${messages[index % messages.length]} ${faker.lorem.words({ min: 3, max: 6 })}`
}

async function seedLargeData(options: SeedOptions) {
	if (options.seed !== null) faker.seed(options.seed)

	console.log('Starting benchmark data load...')
	console.log(
		JSON.stringify(
			{
				users: options.users,
				recipientsPerUser: options.recipientsPerUser,
				messagesPerRecipient: options.messagesPerRecipient,
				sentRatio: options.sentRatio,
				messageBatchSize: options.messageBatchSize,
				reset: options.reset,
				seed: options.seed,
			},
			null,
			2,
		),
	)

	if (options.reset) {
		console.time('reset-db')
		await cleanupDb()
		console.timeEnd('reset-db')
	}

	console.time('base-data')
	await ensurePermissions()
	await ensureRoles()
	await ensureSourceNumber()
	console.timeEnd('base-data')

	const totalRecipients = options.users * options.recipientsPerUser
	const totalMessages = totalRecipients * options.messagesPerRecipient
	console.log(`Target recipients: ${totalRecipients}`)
	console.log(`Target messages: ${totalMessages}`)

	const fallbackSchedule: string = cronSchedules[0] ?? '0 0 9 * * 1-5'
	const fallbackTimeZone: string = timeZones[0] ?? 'America/Denver'
	const messageBatch: Prisma.MessageCreateManyInput[] = []
	const progressInterval = Math.max(1, Math.floor(options.users / 10))
	const loadStart = performance.now()

	for (let userIndex = 0; userIndex < options.users; userIndex++) {
		const userData = createUser()
		const stripeId = `cus_${createId()}`

		const user = await prisma.user.create({
			select: { id: true },
			data: {
				...userData,
				stripeId,
				password: { create: createPassword(userData.username) },
				roles: { connect: { name: 'user' } },
			},
		})

		const recipients: Prisma.RecipientCreateManyInput[] = Array.from(
			{ length: options.recipientsPerUser },
			(_, index) => {
				const lastRemindedAt =
					Math.random() > 0.5
						? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
						: null
				const scheduleCron: string =
					cronSchedules[index % cronSchedules.length] ?? fallbackSchedule
				const timeZone: string =
					timeZones[index % timeZones.length] ?? fallbackTimeZone
				const scheduleWindow = getScheduleWindow(
					scheduleCron,
					timeZone,
					new Date(),
				)
				return {
					id: createId(),
					userId: user.id,
					name: faker.person.fullName(),
					phoneNumber: createPhoneNumber(),
					verified: true,
					disabled: false,
					scheduleCron,
					timeZone,
					prevScheduledAt: scheduleWindow.prevScheduledAt,
					nextScheduledAt: scheduleWindow.nextScheduledAt,
					lastRemindedAt,
				}
			},
		)

		await prisma.recipient.createMany({ data: recipients })

		for (const recipient of recipients) {
			const recipientId: string = recipient.id ?? ''
			if (!recipientId) {
				throw new Error('Recipient id missing during message creation')
			}
			let lastSentAt: Date | null = null
			const sentCount = Math.floor(
				options.messagesPerRecipient * options.sentRatio,
			)
			for (
				let messageIndex = 0;
				messageIndex < options.messagesPerRecipient;
				messageIndex++
			) {
				const isSent = messageIndex < sentCount
				const sentAt = isSent ? faker.date.recent({ days: 90 }) : null
				if (sentAt && (!lastSentAt || sentAt > lastSentAt)) {
					lastSentAt = sentAt
				}

				messageBatch.push({
					id: createId(),
					recipientId,
					content: buildMessageContent(messageIndex),
					sentAt,
					order: messageIndex + 1,
					twilioId: sentAt ? createId() : null,
				})

				if (messageBatch.length >= options.messageBatchSize) {
					await prisma.message.createMany({ data: messageBatch })
					messageBatch.length = 0
				}
			}
			if (lastSentAt) {
				await prisma.recipient.update({
					where: { id: recipientId },
					data: { lastSentAt },
				})
			}
		}

		if ((userIndex + 1) % progressInterval === 0) {
			const elapsed = Math.round(performance.now() - loadStart)
			console.log(
				`Loaded ${userIndex + 1}/${options.users} users in ${elapsed}ms`,
			)
		}
	}

	if (messageBatch.length) {
		await prisma.message.createMany({ data: messageBatch })
		messageBatch.length = 0
	}

	const [usersCount, recipientsCount, messagesCount] =
		await prisma.$transaction([
			prisma.user.count(),
			prisma.recipient.count(),
			prisma.message.count(),
		])

	console.log('Load complete.')
	console.log(
		JSON.stringify(
			{
				users: usersCount,
				recipients: recipientsCount,
				messages: messagesCount,
			},
			null,
			2,
		),
	)
}

const options = parseOptions()

await seedLargeData(options)
	.catch((error) => {
		console.error('Benchmark data load failed:', error)
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
