import { faker } from '@faker-js/faker'
import { test, expect } from 'vitest'
import { createMessage, createRecipient, createUser } from '#tests/db-utils.ts'
import { sendNextTexts } from './cron.server.ts'
import { prisma } from './db.server.ts'

test('does not send any texts if there are none to be sent', async () => {
	await sendNextTexts()
})

test('does not send to unverified recipients', async () => {
	await prisma.user.create({
		data: {
			...createUser(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: false,
						messages: {
							create: { ...createMessage(), sentAt: null },
						},
					},
				],
			},
		},
	})

	await sendNextTexts()
	const sentMessages = await prisma.message.findMany({
		where: { sentAt: { not: null } },
	})
	expect(sentMessages).toHaveLength(0)
})

test('sends a text if one is due', async () => {
	await prisma.user.create({
		data: {
			...createUser(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: true,
						scheduleCron: '*/1 * * * *',
						messages: {
							create: {
								...createMessage(),
								createdAt: faker.date.past(),
								updatedAt: faker.date.past(),
								sentAt: null,
							},
						},
					},
				],
			},
		},
	})
	await sendNextTexts()
	const unsentMessages = await prisma.message.findMany({
		where: { sentAt: null },
	})
	expect(unsentMessages).toHaveLength(0)
})

test(`does not send a text if it is too overdue`, async () => {
	await prisma.user.create({
		data: {
			...createUser(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: true,
						scheduleCron: '* * 1 * *',
						messages: {
							create: { ...createMessage(), sentAt: null },
						},
					},
				],
			},
		},
	})

	await sendNextTexts()
	const sentMessages = await prisma.message.findMany({
		where: { sentAt: { not: null } },
	})
	expect(sentMessages).toHaveLength(0)
})
