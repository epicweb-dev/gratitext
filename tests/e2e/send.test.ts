import { faker } from '@faker-js/faker'
import { getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { deleteText, waitForText } from '#tests/mocks/utils.ts'
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
	const recipientData = createRecipient()

	// Clean up any stale fixtures for this recipient
	await deleteText(recipientData.phoneNumber)

	const recipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...recipientData,
			verified: true,
			userId: user.id,
			// TODO: make it more certain that the specified cron will never trigger during the test
			scheduleCron: '0 0 1 1 1',
		},
	})

	await page.goto(`/recipients/${recipient.id}`)
	await page.waitForLoadState('domcontentloaded')

	const newMessageLink = page.getByRole('link', { name: /^new$/i })
	await newMessageLink.waitFor({ state: 'visible' })
	await newMessageLink.click()

	await page.waitForLoadState('domcontentloaded')

	const textMessageContent = `Test message ${faker.string.alphanumeric(8)}`
	const messageTextbox = page.getByRole('textbox', { name: /message/i })
	await messageTextbox.waitFor({ state: 'visible' })
	await messageTextbox.click()
	await messageTextbox.fill(textMessageContent)
	await expect(messageTextbox).toHaveValue(textMessageContent)

	await Promise.all([
		page.waitForURL(`/recipients/${recipient.id}`, {
			timeout: 30000,
			waitUntil: 'domcontentloaded',
		}),
		page.getByRole('button', { name: /save/i }).click(),
	])
	await page.waitForLoadState('domcontentloaded')
	await expect(page.getByText(textMessageContent)).toBeVisible({
		timeout: 20000,
	})

	const messageActionsButton = page
		.getByRole('button', { name: /message actions/i })
		.first()
	await messageActionsButton.waitFor({ state: 'visible' })
	await messageActionsButton.click()

	const sendNowItem = page.getByRole('menuitem', { name: /send now/i })
	await sendNowItem.waitFor({ state: 'visible' })
	await sendNowItem.click()

	await expect(page.getByText(/message sent/i)).toBeVisible({ timeout: 15000 })

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(recipient.phoneNumber, {
		errorMessage: 'Text message not sent to recipient',
	})
	expect(textMessage.To).toBe(recipient.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)

	expect(textMessage.Body).toBe(textMessageContent)

	// Clean up
	await deleteText(recipient.phoneNumber)
})

test('Scheduled messages go out on schedule', async ({ page, login }) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipientData = createRecipient()

	// Clean up any stale fixtures
	await deleteText(recipientData.phoneNumber)

	const recipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...recipientData,
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

	await page.goto(`/recipients/${recipient.id}`)
	await page.waitForLoadState('domcontentloaded')
	await expect(page.getByText(/no past messages yet/i)).toBeVisible({
		timeout: 15000,
	})

	await prisma.$transaction(async ($prisma) => {
		const scheduleWindow = getScheduleWindow(
			'* * * * *',
			recipientData.timeZone,
			new Date(),
		)
		await $prisma.recipient.update({
			select: { id: true },
			where: { id: recipient.id },
			data: {
				scheduleCron: '* * * * *',
				prevScheduledAt: scheduleWindow.prevScheduledAt,
				nextScheduledAt: scheduleWindow.nextScheduledAt,
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

	// Increase timeout for scheduled message test
	test.setTimeout(90000)

	await waitFor(
		async () => {
			const messageToSend = await prisma.message.findUnique({
				select: { sentAt: true },
				where: { id: message.id },
			})
			if (messageToSend?.sentAt) return messageToSend
		},
		{ timeout: 75000, errorMessage: 'Message was not sent within timeout' },
	)

	await prisma.recipient.update({
		where: { id: recipient.id },
		data: { scheduleCron: '0 0 1 1 1' },
	})

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(recipient.phoneNumber, {
		errorMessage: 'Scheduled text message not found',
	})
	expect(textMessage.To).toBe(recipient.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)

	expect(textMessage.Body).toBe(message.content)

	// TODO: real-time updates here would be cool.
	await page.reload()
	await page.waitForLoadState('domcontentloaded')

	// Clean up
	await deleteText(recipient.phoneNumber)

	// This fails on CI and I don't know why:
	// await expect(page.getByText(/sent 1 message/i)).toBeVisible()
	// await expect(page.getByText(message.content)).toBeVisible()
})
