import { page } from '@vitest/browser/context'
import { createRoutesStub } from 'react-router'
import { type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { useOptionalUser } from '#app/utils/user.ts'
import { default as UsernameRoute } from './$username.tsx'

vi.mock('#app/utils/user.ts', () => ({
	useOptionalUser: vi.fn(),
}))

const mockedUseOptionalUser = vi.mocked(useOptionalUser)

let root: Root | null = null
let container: HTMLDivElement | null = null

const render = (ui: ReactElement) => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	root.render(ui)
}

afterEach(() => {
	root?.unmount()
	root = null
	container?.remove()
	container = null
})

type UserStub = {
	id: string
	username: string
	name: string
	createdAt: Date
}

const buildApp = (user: UserStub) => {
	return createRoutesStub([
		{
			id: 'routes/users.$username',
			path: '/users/:username',
			Component: UsernameRoute,
			loader: async () => ({
				user,
				userJoinedDisplay: user.createdAt.toLocaleDateString(),
			}),
		},
	])
}

test('The user profile when not logged in as self', async () => {
	const user = {
		id: 'user_1',
		username: 'harry',
		name: 'Harry Example',
		createdAt: new Date('2024-01-01T00:00:00Z'),
	}
	mockedUseOptionalUser.mockReturnValue(null)
	const App = buildApp(user)

	const routeUrl = `/users/${user.username}`
	render(<App initialEntries={[routeUrl]} />)

	await expect
		.element(page.getByRole('heading', { level: 1, name: user.name }))
		.toBeVisible()
	await expect
		.element(page.getByRole('link', { name: `${user.name}'s recipients` }))
		.toBeVisible()
})

test('The user profile when logged in as self', async () => {
	const user = {
		id: 'user_2',
		username: 'logan',
		name: 'Logan Example',
		createdAt: new Date('2024-01-01T00:00:00Z'),
	}
	mockedUseOptionalUser.mockReturnValue({
		id: user.id,
		username: user.username,
		name: user.name,
	})
	const App = buildApp(user)

	const routeUrl = `/users/${user.username}`
	render(<App initialEntries={[routeUrl]} />)

	await expect
		.element(page.getByRole('heading', { level: 1, name: user.name }))
		.toBeVisible()
	await expect
		.element(page.getByRole('button', { name: /logout/i }))
		.toBeVisible()
	await expect
		.element(page.getByRole('link', { name: /my recipients/i }))
		.toBeVisible()
	await expect
		.element(page.getByRole('link', { name: /edit profile/i }))
		.toBeVisible()
})
