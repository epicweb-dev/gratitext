import { invariant } from '@epic-web/invariant'
import { faker } from '@faker-js/faker'
import { verifyUserPassword } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { deleteText, waitForText } from '#tests/mocks/utils.ts'
import { createUser, expect, test } from '#tests/playwright-utils.ts'

const CODE_REGEX = /Here's your verification code: (?<code>[\d\w]+)/

test('Users can update their basic info', async ({ page, login }) => {
	await login()

	await page.goto('/settings/profile')
	await page.waitForLoadState('domcontentloaded')

	const newUserData = createUser()

	const nameInput = page.getByRole('textbox', { name: /^name/i })
	await nameInput.waitFor({ state: 'visible' })
	await nameInput.fill(newUserData.name)

	await page.getByRole('button', { name: /^save/i }).click()

	// Wait for save to complete
	await page.waitForLoadState('networkidle').catch(() => {})
})

test('Users can update their password', async ({ page, login }) => {
	const oldPassword = faker.internet.password()
	const newPassword = faker.internet.password()
	const user = await login({ password: oldPassword })

	await page.goto('/settings/profile')
	await page.waitForLoadState('domcontentloaded')

	const changePasswordLink = page.getByRole('link', { name: /change password/i })
	await changePasswordLink.waitFor({ state: 'visible' })
	await changePasswordLink.click()

	await page.waitForLoadState('domcontentloaded')

	const currentPasswordInput = page.getByRole('textbox', { name: /^current password/i })
	await currentPasswordInput.waitFor({ state: 'visible' })
	await currentPasswordInput.fill(oldPassword)
	await page.getByRole('textbox', { name: /^new password/i }).fill(newPassword)
	await page
		.getByRole('textbox', { name: /^confirm new password/i })
		.fill(newPassword)

	await page.getByRole('button', { name: /^save/i }).click()

	await expect(page).toHaveURL(`/settings/profile`, { timeout: 15000 })

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

	// Clean up any stale fixtures for both phone numbers
	await deleteText(newPhoneNumber)
	await deleteText(preUpdateUser.phoneNumber)

	await page.goto('/settings/profile')
	await page.waitForLoadState('domcontentloaded')

	const changeNumberLink = page.getByRole('link', { name: /change number/i })
	await changeNumberLink.waitFor({ state: 'visible' })
	await changeNumberLink.click()

	await page.waitForLoadState('domcontentloaded')

	const newPhoneInput = page.getByRole('textbox', { name: /new phone number/i })
	await newPhoneInput.waitFor({ state: 'visible' })
	await newPhoneInput.fill(newPhoneNumber)
	await page.getByRole('button', { name: /send confirmation/i }).click()

	await expect(page.getByText(/check your texts/i)).toBeVisible({ timeout: 15000 })

	const text = await waitForText(newPhoneNumber, {
		errorMessage: 'Confirmation text message was not sent',
	})
	invariant(text, 'Text was not sent')
	const codeMatch = text.Body.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Verification code not found')

	const codeInput = page.getByRole('textbox', { name: /code/i })
	await codeInput.waitFor({ state: 'visible' })
	await codeInput.fill(code)
	await page.getByRole('button', { name: /continue/i }).click()

	await expect(page.getByText(/phone number changed/i)).toBeVisible({ timeout: 15000 })

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

	// Clean up fixtures
	await deleteText(newPhoneNumber)
	await deleteText(preUpdateUser.phoneNumber)
})
