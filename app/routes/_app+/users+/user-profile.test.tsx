import { page } from 'vitest/browser'
import { type ComponentProps, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { UserProfileView } from '#app/components/user-profile.tsx'

let root: Root | null = null
let container: HTMLDivElement | null = null

const render = (ui: ReactElement) => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
	root.render(ui)
}

const renderProfile = (props: ComponentProps<typeof UserProfileView>) => {
	const router = createMemoryRouter(
		[
			{
				path: '/',
				element: <UserProfileView {...props} />,
			},
		],
		{ initialEntries: ['/'] },
	)

	render(<RouterProvider router={router} />)
}

afterEach(() => {
	root?.unmount()
	root = null
	container?.remove()
	container = null
})

test('The user profile when not logged in as self', async () => {
	const user = {
		id: 'user_1',
		username: 'harry',
		name: 'Harry Example',
	}

	renderProfile({
		user,
		userJoinedDisplay: 'Jan 1, 2024',
		isLoggedInUser: false,
	})

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
	}

	renderProfile({
		user,
		userJoinedDisplay: 'Jan 1, 2024',
		isLoggedInUser: true,
	})

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
