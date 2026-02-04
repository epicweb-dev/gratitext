import { type ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { UserProfileView } from './user-profile.tsx'

const renderProfile = async (props: ComponentProps<typeof UserProfileView>) => {
	const router = createMemoryRouter(
		[
			{
				path: '/',
				element: <UserProfileView {...props} />,
			},
		],
		{ initialEntries: ['/'] },
	)

	return render(<RouterProvider router={router} />)
}

afterEach(() => {
	document.body.innerHTML = ''
})

test('The user profile when not logged in as self', async () => {
	const user = {
		id: 'user_1',
		username: 'harry',
		name: 'Harry Example',
	}

	const screen = await renderProfile({
		user,
		userJoinedDisplay: 'Jan 1, 2024',
		isLoggedInUser: false,
	})

	await expect
		.element(screen.getByRole('heading', { level: 1, name: user.name }))
		.toBeVisible()
	await expect
		.element(screen.getByRole('link', { name: `${user.name}'s recipients` }))
		.toBeVisible()
})

test('The user profile when logged in as self', async () => {
	const user = {
		id: 'user_2',
		username: 'logan',
		name: 'Logan Example',
	}

	const screen = await renderProfile({
		user,
		userJoinedDisplay: 'Jan 1, 2024',
		isLoggedInUser: true,
	})

	await expect
		.element(screen.getByRole('heading', { level: 1, name: user.name }))
		.toBeVisible()
	await expect
		.element(screen.getByRole('button', { name: /logout/i }))
		.toBeVisible()
	await expect
		.element(screen.getByRole('link', { name: /my recipients/i }))
		.toBeVisible()
	await expect
		.element(screen.getByRole('link', { name: /edit profile/i }))
		.toBeVisible()
})
