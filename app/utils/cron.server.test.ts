import { faker } from '@faker-js/faker'
import { test, expect } from 'vitest'
import { createMessage, createRecipient, createUser } from '#tests/db-utils.ts'
import { getScheduleWindow, sendNextTexts } from './cron.server.ts'
import { prisma } from './db.server.ts'
import { SCHEDULE_SENTINEL_DATE } from './schedule-constants.server.ts'

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

	// Use a cron that's monthly - too overdue to send
	const scheduleCron = '* * 1 * *'
	const timeZone = 'America/Denver'
	let scheduleData: { prevScheduledAt: Date; nextScheduledAt: Date }
	try {
		scheduleData = getScheduleWindow(scheduleCron, timeZone)
	} catch {
		scheduleData = {
			prevScheduledAt: SCHEDULE_SENTINEL_DATE,
			nextScheduledAt: SCHEDULE_SENTINEL_DATE,
		}
	}

	await prisma.user.create({
		data: {
			...createUser(),
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
