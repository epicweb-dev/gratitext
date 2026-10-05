import { faker } from '@faker-js/faker'
import { prisma } from '#app/utils/db.server.ts'
import { createRecipient, expect, test } from '#tests/playwright-utils.ts'

async function createVerifiedRecipient(userId: string) {
	return prisma.recipient.create({
		select: { id: true },
		data: {
			...createRecipient(),
			verified: true,
			userId,
			scheduleCron: '0 0 1 1 1',
		},
	})
}

test('Enter adds a newline to a new message instead of queueing it', async ({
	page,
	login,
}) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipient = await createVerifiedRecipient(user.id)

	await page.goto(`/recipients/${recipient.id}`)
	await page.waitForLoadState('networkidle')
	const input = page.getByRole('textbox', { name: /add a new message/i })
	await input.click()
	await input.pressSequentially('First line')
	await input.press('Enter')
	await input.pressSequentially('Second line')
	await expect(input).toHaveValue('First line\nSecond line')
	const getQueuedContent = async () => {
		const messages = await prisma.message.findMany({
			where: { recipientId: recipient.id },
			select: { content: true },
		})
		return messages.map((m) => m.content).sort()
	}
	expect(await getQueuedContent()).toEqual([])

	await page.getByRole('button', { name: /add to queue/i }).click()
	await expect(input).toHaveValue('')
	await expect.poll(getQueuedContent).toEqual(['First line\nSecond line'])

	await input.pressSequentially('Shortcut')
	await input.press('ControlOrMeta+Enter')
	await expect(input).toHaveValue('')
	await expect
		.poll(getQueuedContent)
		.toEqual(['First line\nSecond line', 'Shortcut'])
})

test('Scrolling to the top of the thread loads earlier messages', async ({
	page,
	login,
}) => {
	const user = await login({ stripeId: faker.string.uuid() })
	const recipient = await createVerifiedRecipient(user.id)
	const messageCount = 75
	const firstSentAt = new Date('2025-01-01T12:00:00Z').getTime()
	await prisma.message.createMany({
		data: Array.from({ length: messageCount }, (_, i) => ({
			recipientId: recipient.id,
			content: `Past message ${i + 1}`,
			sentAt: new Date(firstSentAt + i * 1000 * 60 * 60 * 24),
			order: i,
		})),
	})

	await page.goto(`/recipients/${recipient.id}`)
	await page.waitForLoadState('networkidle')
	const thread = page.getByRole('region', { name: 'Messages' })
	const messages = thread.getByText(/^Past message \d+$/)
	await expect(
		thread.getByText('Past message 75', { exact: true }),
	).toBeVisible()
	await expect(messages).toHaveCount(30)

	const scrollToTop = async () => {
		await messages.last().hover()
		await page.mouse.wheel(0, -100_000)
	}

	await scrollToTop()
	await expect(messages).toHaveCount(60)
	await scrollToTop()
	await expect(messages).toHaveCount(messageCount)
	await expect(
		thread.getByText('Past message 1', { exact: true }),
	).toBeAttached()
	await expect(
		thread.getByText(/scroll up to load earlier messages/i),
	).toHaveCount(0)
})
