import { faker } from '@faker-js/faker'
import { test, expect } from 'vitest'
import { createMessage, createRecipient, createUser } from '#tests/db-utils.ts'
import { sendNextTexts, upsertRecipientJob } from './cron.server.ts'
import { prisma } from './db.server.ts'

test('does not send any texts if there are none to be sent', async () => {
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})
	await sendNextTexts()
})

test('does not send to unverified recipients', async () => {
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})
	const user = await prisma.user.create({
		data: {
			...createUser(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: false,
						scheduleCron: '*/1 * * * *',
						messages: {
							create: { ...createMessage(), sentAt: null },
						},
					},
				],
			},
		},
		select: { recipients: { select: { id: true } } },
	})

	const recipientId = user.recipients[0]?.id
	if (recipientId) {
		await upsertRecipientJob(recipientId, { reschedule: false })
	}

	await sendNextTexts()
	const sentMessages = await prisma.message.findMany({
		where: { sentAt: { not: null } },
	})
	expect(sentMessages).toHaveLength(0)
})

test('sends a text if one is due', async () => {
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})
	const user = await prisma.user.create({
		data: {
			...createUser(),
			stripeId: faker.string.uuid(),
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
		select: { recipients: { select: { id: true } } },
	})
	const recipientId = user.recipients[0]?.id
	if (recipientId) {
		await upsertRecipientJob(recipientId, { reschedule: false })
	}
	await sendNextTexts()
	const unsentMessages = await prisma.message.findMany({
		where: { sentAt: null },
	})
	expect(unsentMessages).toHaveLength(0)
})

test(`does not send a text if it is too overdue`, async () => {
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})
	const user = await prisma.user.create({
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
		select: { recipients: { select: { id: true } } },
	})
	const recipientId = user.recipients[0]?.id
	if (recipientId) {
		await upsertRecipientJob(recipientId, { reschedule: false })
		await prisma.recipientJob.update({
			where: { recipientId },
			data: { runAt: new Date() },
		})
	}

	await sendNextTexts()
	const sentMessages = await prisma.message.findMany({
		where: { sentAt: { not: null } },
	})
	expect(sentMessages).toHaveLength(0)
})
