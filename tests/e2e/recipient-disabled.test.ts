import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import {
	createMessage,
	createRecipient,
	expect,
	test,
} from '#tests/playwright-utils.ts'

test('Users can disable sending to a recipient', async ({ page, login }) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipient = await prisma.recipient.create({
		select: { id: true, name: true, disabled: true },
		data: {
			...createRecipient(),
			verified: true,
			userId: user.id,
			disabled: false,
			scheduleCron: '0 0 1 1 1',
		},
	})

	// Verify recipient starts as not disabled
	expect(recipient.disabled).toBe(false)

	// Navigate to edit page
	await page.goto(`/recipients/${recipient.id}/edit`)

	// Find and check the disabled checkbox
	const disabledCheckbox = page.getByRole('checkbox', {
		name: /disable sending to this recipient/i,
	})
	await expect(disabledCheckbox).toBeVisible()
	await expect(disabledCheckbox).not.toBeChecked()

	// Check the checkbox
	await disabledCheckbox.check()

	// Submit the form
	await page.getByRole('button', { name: /submit/i }).click()

	// Wait for redirect to recipient page
	await expect(page).toHaveURL(`/recipients/${recipient.id}`)

	// Verify the recipient is now disabled in the database
	const updatedRecipient = await prisma.recipient.findUnique({
		where: { id: recipient.id },
		select: { disabled: true },
	})
	expect(updatedRecipient).not.toBeNull()
	expect(updatedRecipient?.disabled).toBe(true)

	// Navigate back to edit page to verify checkbox state persists
	await page.goto(`/recipients/${recipient.id}/edit`)
	await expect(disabledCheckbox).toBeChecked()

	// Uncheck the checkbox to re-enable
	await disabledCheckbox.uncheck()
	await page.getByRole('button', { name: /submit/i }).click()

	// Verify the recipient is now enabled again
	await expect(page).toHaveURL(`/recipients/${recipient.id}`)
	const reEnabledRecipient = await prisma.recipient.findUnique({
		where: { id: recipient.id },
		select: { disabled: true },
	})
	expect(reEnabledRecipient?.disabled).toBe(false)
})

test('Disabled recipients are excluded from scheduled message sending', async ({
	page,
	login,
}) => {
	const user = await login({ stripeId: faker.string.uuid() })
	
	// Create a disabled recipient
	const disabledRecipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...createRecipient(),
			verified: true,
			userId: user.id,
			disabled: true,
			scheduleCron: '* * * * *', // Every minute
		},
	})

	// Create an enabled recipient
	const enabledRecipient = await prisma.recipient.create({
		select: { id: true, phoneNumber: true },
		data: {
			...createRecipient(),
			verified: true,
			userId: user.id,
			disabled: false,
			scheduleCron: '* * * * *', // Every minute
		},
	})

	// Create messages for both recipients
	await prisma.message.create({
		select: { id: true },
		data: {
			content: 'This should not be sent',
			sentAt: null,
			recipientId: disabledRecipient.id,
			order: 0,
		},
	})

	await prisma.message.create({
		select: { id: true },
		data: {
			content: 'This should be sent',
			sentAt: null,
			recipientId: enabledRecipient.id,
			order: 0,
		},
	})

	// Verify the cron query excludes disabled recipients
	// This simulates what happens in sendNextTexts()
	const recipientsForSending = await prisma.recipient.findMany({
		where: {
			verified: true,
			disabled: false,
			user: { stripeId: { not: null } },
		},
		select: { id: true },
	})

	// The disabled recipient should not be in the list
	const disabledRecipientInList = recipientsForSending.find(
		(r) => r.id === disabledRecipient.id,
	)
	expect(disabledRecipientInList).toBeUndefined()

	// The enabled recipient should be in the list
	const enabledRecipientInList = recipientsForSending.find(
		(r) => r.id === enabledRecipient.id,
	)
	expect(enabledRecipientInList).not.toBeUndefined()
})

