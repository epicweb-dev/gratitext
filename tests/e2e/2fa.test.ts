import { faker } from '@faker-js/faker'
import { generateTOTP } from '#app/utils/totp.server.ts'
import { expect, test } from '#tests/playwright-utils.ts'

test('Users can add 2FA to their account and use it when logging in', async ({
	page,
	login,
}) => {
	const password = faker.internet.password()
	const user = await login({ password })

	await page.goto('/settings/profile')
	await page.waitForLoadState('domcontentloaded')

	const enable2faLink = page.getByRole('link', { name: /enable 2fa/i })
	await enable2faLink.waitFor({ state: 'visible' })
	await enable2faLink.click()

	await expect(page).toHaveURL(`/settings/profile/two-factor`)
	await page.waitForLoadState('domcontentloaded')

	const main = page.getByRole('main')
	const enable2faButton = main.getByRole('button', { name: /enable 2fa/i })
	await enable2faButton.waitFor({ state: 'visible' })
	await enable2faButton.click()

	const otpUriLabel = main.getByLabel(/One-Time Password URI/i)
	await otpUriLabel.waitFor({ state: 'visible' })
	const otpUriString = await otpUriLabel.innerText()

	const otpUri = new URL(otpUriString)
	const options = Object.fromEntries(otpUri.searchParams)

	const codeInput = main.getByRole('textbox', { name: /code/i })
	await codeInput.waitFor({ state: 'visible' })
	const { otp: initialOtp } = await generateTOTP(options)
	await codeInput.fill(initialOtp)
	await main.getByRole('button', { name: /submit/i }).click()

	await expect(main).toHaveText(/You have enabled two-factor authentication./i)
	await expect(main.getByRole('link', { name: /disable 2fa/i })).toBeVisible()

	const userMenuLink = page.getByRole('link', {
		name: user.name ?? user.username,
	})
	await userMenuLink.waitFor({ state: 'visible' })
	await userMenuLink.click()

	const logoutButton = page.getByRole('button', { name: /logout/i })
	await logoutButton.waitFor({ state: 'visible' })
	await logoutButton.click()
	await expect(page).toHaveURL(`/`)

	await page.goto('/login')
	await page.waitForLoadState('domcontentloaded')
	await expect(page).toHaveURL(`/login`)

	const usernameInput = page.getByRole('textbox', { name: /username/i })
	await usernameInput.waitFor({ state: 'visible' })
	await usernameInput.fill(user.username)
	await page.getByLabel(/^password$/i).fill(password)
	await page.getByRole('button', { name: /log in/i }).click()

	// Wait for 2FA page to load
	const totpCodeInput = page.getByRole('textbox', { name: /code/i })
	await totpCodeInput.waitFor({ state: 'visible', timeout: 15000 })
	const { otp: loginOtp } = await generateTOTP(options)
	await totpCodeInput.fill(loginOtp)

	await page.getByRole('button', { name: /continue/i }).click()

	await expect(
		page.getByRole('link', { name: user.name ?? user.username }),
	).toBeVisible({ timeout: 15000 })
})
