import { invariant } from '@epic-web/invariant'
import { faker } from '@faker-js/faker'
import { verifyUserPassword } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { waitForText } from '#tests/mocks/utils.ts'
import { createUser, expect, test } from '#tests/playwright-utils.ts'

const CODE_REGEX = /Here's your verification code: (?<code>[\d\w]+)/

test('Users can update their basic info', async ({ page, login }) => {
	await login()
	await page.goto('/settings/profile')

	const newUserData = createUser()

	await page.getByRole('textbox', { name: /^name/i }).fill(newUserData.name)
	await page
		.getByRole('textbox', { name: /^username/i })
		.fill(newUserData.username)

	await page.getByRole('button', { name: /^save/i }).click()
})

test('Users can update their password', async ({ page, login }) => {
	const oldPassword = faker.internet.password()
	const newPassword = faker.internet.password()
	const user = await login({ password: oldPassword })
	await page.goto('/settings/profile')

	await page.getByRole('link', { name: /change password/i }).click()

	await page
		.getByRole('textbox', { name: /^current password/i })
		.fill(oldPassword)
	await page.getByRole('textbox', { name: /^new password/i }).fill(newPassword)
	await page
		.getByRole('textbox', { name: /^confirm new password/i })
		.fill(newPassword)

	await page.getByRole('button', { name: /^change password/i }).click()

	await expect(page).toHaveURL(`/settings/profile`)

	const { username } = user
	expect(
		await verifyUserPassword({ username }, oldPassword),
		'Old password still works',
	).toBeNull()
	expect(
		await verifyUserPassword({ username }, newPassword),
		'New password does not work',
	).toEqual({ id: user.id })
})

test('Users can change their phone number', async ({ page, login }) => {
	const preUpdateUser = await login()
	const newPhoneNumber = faker.phone.number()
	expect(preUpdateUser.phoneNumber).not.toEqual(newPhoneNumber)
	await page.goto('/settings/profile')
	await page.getByRole('link', { name: /change number/i }).click()
	await page
		.getByRole('textbox', { name: /new phone number/i })
		.fill(newPhoneNumber)
	await page.getByRole('button', { name: /send confirmation/i }).click()
	await expect(page.getByText(/check your texts/i)).toBeVisible()
	const text = await waitForText(newPhoneNumber, {
		errorMessage: 'Confirmation text message was not sent',
	})
	invariant(text, 'Text was not sent')
	const codeMatch = text.Body.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Onboarding code not found')
	await page.getByRole('textbox', { name: /code/i }).fill(code)
	await page.getByRole('button', { name: /submit/i }).click()
	await expect(page.getByText(/phone number changed/i)).toBeVisible()

	const updatedUser = await prisma.user.findUnique({
		where: { id: preUpdateUser.id },
		select: { phoneNumber: true },
	})
	invariant(updatedUser, 'Updated user not found')
	expect(updatedUser.phoneNumber).toBe(newPhoneNumber)
	const noticeText = await waitForText(preUpdateUser.phoneNumber, {
		errorMessage: 'Notice text was not sent',
	})
	expect(noticeText.Body).toContain('changed')
})
