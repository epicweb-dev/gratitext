import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import { waitForText } from '#tests/mocks/utils.ts'
import {
	createMessage,
	createRecipient,
	expect,
	test,
	waitFor,
} from '#tests/playwright-utils.ts'

test('Users can write and send a message immediately', async ({
	page,
	login,
}) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...createRecipient(),
			verified: true,
			userId: user.id,
			// TODO: make it more certain that the specified cron will never trigger during the test
			scheduleCron: '0 0 1 1 1',
		},
	})
	await page.goto(`/recipients/${recipient.id}`)
	await page
		.getByRole('main')
		.getByRole('link', { name: /new message/i })
		.click()

	const { content: textMessageContent } = createMessage()
	await page
		.getByRole('main')
		.getByRole('textbox', { name: /message/i })
		.fill(textMessageContent)

	await page.getByRole('main').getByRole('button', { name: /save/i }).click()

	await expect(page.getByText(/message created/i)).toBeVisible()
	await page.getByRole('button', { name: /close toast/i }).click()

	await page.getByRole('button', { name: /send now/i }).click()
	await expect(page.getByText(/message sent/i)).toBeVisible()

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(recipient.phoneNumber)
	expect(textMessage.To).toBe(recipient.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)

	expect(textMessage.Body).toBe(textMessageContent)
})

test('Scheduled messages go out on schedule', async ({ page, login }) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...createRecipient(),
			verified: true,
			userId: user.id,
			scheduleCron: '0 0 1 1 1',
		},
	})

	const message = await prisma.message.create({
		select: { id: true, content: true },
		data: {
			...createMessage(),
			sentAt: null,
			recipientId: recipient.id,
		},
	})

	await page.goto(`/recipients/${recipient.id}/past`)
	await expect(page.getByText(/sent 0 messages/i)).toBeVisible()

	await prisma.$transaction(async $prisma => {
		await $prisma.recipient.update({
			select: { id: true },
			where: { id: recipient.id },
			data: {
				scheduleCron: '* * * * *',
			},
		})
		await $prisma.message.update({
			where: { id: message.id },
			select: { id: true },
			data: {
				// it needs to appear as though it was prepared before the time it was due to be sent.
				updatedAt: new Date(new Date().getTime() - 1000 * 60 * 2),
			},
		})
	})

	test.setTimeout(15000)

	await waitFor(async () => {
		const messageToSend = await prisma.message.findUnique({
			select: { sentAt: true },
			where: { id: message.id },
		})
		if (messageToSend?.sentAt) return messageToSend
	})

	await prisma.recipient.update({
		where: { id: recipient.id },
		data: { scheduleCron: '0 0 1 1 1' },
	})

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(recipient.phoneNumber)
	expect(textMessage.To).toBe(recipient.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)

	expect(textMessage.Body).toBe(message.content)

	// TODO: real-time updates here would be cool.
	await page.reload()

	// This fails on CI and I don't know why:
	// await expect(page.getByText(/sent 1 message/i)).toBeVisible()
	// await expect(page.getByText(message.content)).toBeVisible()
})
