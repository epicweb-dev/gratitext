import { invariant } from '@epic-web/invariant'
import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import { deleteText, waitForText } from '#tests/mocks/utils.ts'
import { test as base, createUser, expect } from '#tests/playwright-utils.ts'

const URL_REGEX = /(?<url>https?:\/\/[^\s$.?#].[^\s]*)/
const CODE_REGEX = /code: (?<code>[\d\w]+)/
const defaultCountryCode = '+1'
function extractUrl(text: string) {
	const match = text.match(URL_REGEX)
	return match?.groups?.url
}
function formatPhoneNumber(
	phoneNumber: string,
	countryCode = defaultCountryCode,
) {
	const digitsOnly = phoneNumber.replace(/\D/g, '')
	if (phoneNumber.trim().startsWith('+')) {
		return `+${digitsOnly}`.replace(/\s+/g, '')
	}
	return `${countryCode}${digitsOnly}`.replace(/\s+/g, '')
}

const test = base.extend<{
	getOnboardingData(): {
		username: string
		name: string
		phoneNumber: string
		password: string
	}
}>({
	getOnboardingData: async ({}, use) => {
		const userData = createUser()
		// Clean up any stale text fixtures for this phone number before test
		await deleteText(userData.phoneNumber)
		await deleteText(formatPhoneNumber(userData.phoneNumber))
		// eslint-disable-next-line react-hooks/rules-of-hooks
		await use(() => {
			const onboardingData = {
				...userData,
				password: faker.internet.password(),
			}
			return onboardingData
		})
		await prisma.user.deleteMany({ where: { username: userData.username } })
		// Clean up text fixtures after test
		await deleteText(userData.phoneNumber)
		await deleteText(formatPhoneNumber(userData.phoneNumber))
	},
})

test('onboarding with link', async ({ page, getOnboardingData }) => {
	const onboardingData = getOnboardingData()

	await page.goto('/')
	await page.waitForLoadState('domcontentloaded')

	const loginLink = page.getByRole('link', { name: /log in/i })
	await loginLink.waitFor({ state: 'visible' })
	await loginLink.click()
	await expect(page).toHaveURL(`/login`)

	const createAccountLink = page.getByRole('link', {
		name: /create an account/i,
	})
	await createAccountLink.waitFor({ state: 'visible' })
	await createAccountLink.click()

	await expect(page).toHaveURL(`/signup`)
	await page.waitForLoadState('domcontentloaded')

	const phoneNumberTextbox = page.getByRole('textbox', {
		name: /phone number/i,
	})
	await phoneNumberTextbox.waitFor({ state: 'visible' })
	await phoneNumberTextbox.click()
	await phoneNumberTextbox.fill(onboardingData.phoneNumber)

	await page.getByRole('button', { name: /continue/i }).click()
	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })
	await expect(page.getByText(/check your texts/i)).toBeVisible()

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const targetPhoneNumber = formatPhoneNumber(onboardingData.phoneNumber)
	const textMessage = await waitForText(targetPhoneNumber, {
		errorMessage: 'Onboarding text message not found',
	})
	expect(textMessage.To).toBe(targetPhoneNumber.toLowerCase())
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)
	expect(textMessage.Body).toMatch(/welcome/i)
	const onboardingUrl = extractUrl(textMessage.Body)
	invariant(onboardingUrl, 'Onboarding URL not found')
	await page.goto(onboardingUrl)
	await page.waitForLoadState('domcontentloaded')

	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })

	const submitButton = page
		.getByRole('main')
		.getByRole('button', { name: /continue/i })
	await submitButton.waitFor({ state: 'visible' })
	await submitButton.click()

	await expect(page).toHaveURL(`/onboarding`, { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	const usernameInput = page.getByRole('textbox', { name: /^username/i })
	await usernameInput.waitFor({ state: 'visible' })
	await usernameInput.fill(onboardingData.username)

	await page.getByRole('textbox', { name: /^name/i }).fill(onboardingData.name)

	await page.getByLabel(/^password/i).fill(onboardingData.password)

	await page.getByLabel(/^confirm password/i).fill(onboardingData.password)

	await page.getByLabel(/terms/i).check()

	await page.getByRole('button', { name: /Create an account/i }).click()

	await expect(page).toHaveURL(`/`, { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	const userMenuLink = page.getByRole('link', { name: onboardingData.name })
	await userMenuLink.waitFor({ state: 'visible' })
	await userMenuLink.click()

	const profileMenuItem = page.getByRole('menuitem', { name: /profile/i })
	await profileMenuItem.waitFor({ state: 'visible' })
	await profileMenuItem.click()

	await expect(page).toHaveURL(`/users/${onboardingData.username}`)

	await page.getByRole('link', { name: onboardingData.name }).click()
	const logoutMenuItem = page.getByRole('menuitem', { name: /logout/i })
	await logoutMenuItem.waitFor({ state: 'visible' })
	await logoutMenuItem.click()
	await expect(page).toHaveURL(`/`)
})

test('onboarding with a short code', async ({ page, getOnboardingData }) => {
	const onboardingData = getOnboardingData()

	await page.goto('/signup')
	await page.waitForLoadState('domcontentloaded')

	const phoneNumberTextbox = page.getByRole('textbox', {
		name: /phone number/i,
	})
	await phoneNumberTextbox.waitFor({ state: 'visible' })
	await phoneNumberTextbox.click()
	await phoneNumberTextbox.fill(onboardingData.phoneNumber)

	await page.getByRole('button', { name: /continue/i }).click()
	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })
	await expect(page.getByText(/Check your texts/i)).toBeVisible()

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const targetPhoneNumber = formatPhoneNumber(onboardingData.phoneNumber)
	const textMessage = await waitForText(targetPhoneNumber, {
		errorMessage: 'Onboarding code text not found',
	})
	expect(textMessage.To).toBe(targetPhoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)
	expect(textMessage.Body).toMatch(/welcome/i)
	const codeMatch = textMessage.Body.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Onboarding code not found')

	const codeInput = page.getByRole('textbox', { name: /code/i })
	await codeInput.waitFor({ state: 'visible' })
	await codeInput.fill(code)
	await page.getByRole('button', { name: /continue/i }).click()

	await expect(page).toHaveURL(`/onboarding`, { timeout: 15_000 })
})

test('login as existing user', async ({ page, insertNewUser }) => {
	const password = faker.internet.password()
	const user = await insertNewUser({ password })
	invariant(user.name, 'User name not found')

	await page.goto('/login')
	await page.waitForLoadState('domcontentloaded')

	const phoneNumberInput = page.getByRole('textbox', { name: /phone number/i })
	await phoneNumberInput.waitFor({ state: 'visible' })
	await phoneNumberInput.fill(user.phoneNumber)
	await page.getByLabel(/^password$/i).fill(password)
	await page.getByRole('button', { name: /log in/i }).click()

	await expect(page).toHaveURL(`/`, { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	await expect(page.getByRole('link', { name: user.name })).toBeVisible()
})

test('reset password with a link', async ({ page, insertNewUser }) => {
	const originalPassword = faker.internet.password()
	const user = await insertNewUser({ password: originalPassword })
	invariant(user.name, 'User name not found')

	await page.goto('/login')
	await page.waitForLoadState('domcontentloaded')

	const forgotPasswordLink = page.getByRole('link', {
		name: /forgot password/i,
	})
	await forgotPasswordLink.waitFor({ state: 'visible' })
	await forgotPasswordLink.click()
	await expect(page).toHaveURL('/forgot-password')
	await page.waitForLoadState('domcontentloaded')

	await expect(
		page.getByRole('heading', { name: /forgot password/i }),
	).toBeVisible()

	const phoneNumberInput = page.getByRole('textbox', { name: /phone number/i })
	await phoneNumberInput.waitFor({ state: 'visible' })
	await phoneNumberInput.fill(user.phoneNumber)
	await page.getByRole('button', { name: /recover password/i }).click()
	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })
	await expect(page.getByText(/check your texts/i)).toBeVisible()

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(user.phoneNumber, {
		errorMessage: 'Password reset text not found',
	})
	expect(textMessage.Body).toMatch(/password reset/i)
	expect(textMessage.To).toBe(user.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)
	const resetPasswordUrl = extractUrl(textMessage.Body)
	invariant(resetPasswordUrl, 'Reset password URL not found')

	await page.goto(resetPasswordUrl)
	await page.waitForLoadState('domcontentloaded')

	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })

	const submitButton = page
		.getByRole('main')
		.getByRole('button', { name: /continue/i })
	await submitButton.waitFor({ state: 'visible' })
	await submitButton.click()

	await expect(page).toHaveURL(`/reset-password`, { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	const newPassword = faker.internet.password()
	const newPasswordInput = page.getByLabel(/^new password$/i)
	await newPasswordInput.waitFor({ state: 'visible' })
	await newPasswordInput.fill(newPassword)
	await page.getByLabel(/^confirm password$/i).fill(newPassword)

	await page.getByRole('button', { name: /reset password/i }).click()

	await expect(page).toHaveURL('/login', { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	const loginPhoneInput = page.getByRole('textbox', { name: /phone number/i })
	await loginPhoneInput.waitFor({ state: 'visible' })
	await loginPhoneInput.fill(user.phoneNumber)
	await page.getByLabel(/^password$/i).fill(originalPassword)
	await page.getByRole('button', { name: /log in/i }).click()

	await expect(
		page.getByText(/invalid phone number or password/i),
	).toBeVisible()

	await loginPhoneInput.fill(user.phoneNumber)
	await page.getByLabel(/^password$/i).fill(newPassword)
	await page.getByRole('button', { name: /log in/i }).click()

	await expect(page).toHaveURL(`/`, { timeout: 15_000 })

	await expect(page.getByRole('link', { name: user.name })).toBeVisible()
})

test('reset password with a short code', async ({ page, insertNewUser }) => {
	const user = await insertNewUser()

	await page.goto('/login')
	await page.waitForLoadState('domcontentloaded')

	const forgotPasswordLink = page.getByRole('link', {
		name: /forgot password/i,
	})
	await forgotPasswordLink.waitFor({ state: 'visible' })
	await forgotPasswordLink.click()
	await expect(page).toHaveURL('/forgot-password', { timeout: 15_000 })
	await page.waitForLoadState('domcontentloaded')

	await expect(
		page.getByRole('heading', { name: /forgot password/i }),
	).toBeVisible()

	const phoneNumberInput = page.getByRole('textbox', { name: /phone number/i })
	await phoneNumberInput.waitFor({ state: 'visible' })
	await phoneNumberInput.fill(user.phoneNumber)
	await page.getByRole('button', { name: /recover password/i }).click()
	await expect(page).toHaveURL(/\/verify/, { timeout: 15_000 })
	await expect(page.getByText(/Check your texts/i)).toBeVisible()

	const sourceNumber = await prisma.sourceNumber.findFirstOrThrow({
		select: { phoneNumber: true },
	})
	const textMessage = await waitForText(user.phoneNumber, {
		errorMessage: 'Password reset code text not found',
	})
	expect(textMessage.Body).toMatch(/password reset/i)
	expect(textMessage.To).toBe(user.phoneNumber)
	expect(textMessage.From).toBe(sourceNumber.phoneNumber)
	const codeMatch = textMessage.Body.match(CODE_REGEX)
	const code = codeMatch?.groups?.code
	invariant(code, 'Reset Password code not found')

	const codeInput = page.getByRole('textbox', { name: /code/i })
	await codeInput.waitFor({ state: 'visible' })
	await codeInput.fill(code)
	await page.getByRole('button', { name: /continue/i }).click()

	await expect(page).toHaveURL(`/reset-password`, { timeout: 15_000 })
})
