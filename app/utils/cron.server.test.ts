import '#tests/setup/setup-test-env.ts'
import { faker } from '@faker-js/faker'
import { expect, test } from 'bun:test'
import { createMessage, createRecipient, createUser } from '#tests/db-utils.ts'
import { sendNextTexts } from './cron-runner.server.ts'
import { getScheduleWindow } from './cron.server.ts'
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
	await prisma.user.create({
		data: {
			...createUser(),
			stripeId: faker.string.uuid(),
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
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})

	// Compute schedule based on the actual cron being used
	const scheduleCron = '*/1 * * * *'
	const timeZone = 'America/Denver'
	const scheduleData = getScheduleWindow(scheduleCron, timeZone)

	await prisma.user.create({
		data: {
			...createUser(),
			stripeId: faker.string.uuid(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: true,
						scheduleCron,
						timeZone,
						prevScheduledAt: scheduleData.prevScheduledAt,
						nextScheduledAt: scheduleData.nextScheduledAt,
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
	console.log(unsentMessages)
	expect(unsentMessages).toHaveLength(0)
})

test(`does not send a text if it is too overdue`, async () => {
	await prisma.sourceNumber.create({
		data: { phoneNumber: faker.phone.number() },
	})

	// Use a cron that's monthly, but force an overdue window within the reminder cutoff
	const scheduleCron = '* * 1 * *'
	const timeZone = 'America/Denver'
	const now = new Date()
	const prevScheduledAt = new Date(now.getTime() - 1000 * 60 * 60)
	const nextScheduledAt = new Date(now.getTime() + 1000 * 60 * 5)

	await prisma.user.create({
		data: {
			...createUser(),
			stripeId: faker.string.uuid(),
			recipients: {
				create: [
					{
						...createRecipient(),
						verified: true,
						scheduleCron,
						timeZone,
						prevScheduledAt,
						nextScheduledAt,
						messages: {
							create: {
								...createMessage(),
								createdAt: new Date(prevScheduledAt.getTime() - 1000 * 60 * 2),
								updatedAt: new Date(prevScheduledAt.getTime() - 1000 * 60),
								sentAt: null,
							},
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
