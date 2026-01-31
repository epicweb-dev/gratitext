import { page } from 'vitest/browser'
import {
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { useOptionalUser } from '#app/utils/user.ts'
import { default as UserProfile } from './user-profile.tsx'

type LinkProps = ComponentPropsWithoutRef<'a'> & {
	to?: string | { pathname?: string }
	children?: ReactNode
}

type FormProps = ComponentPropsWithoutRef<'form'> & {
	children?: ReactNode
}

const routerMocks = vi.hoisted(() => ({
	useLoaderData: vi.fn(),
	Link: ({ to, children, ...props }: LinkProps) => (
		<a href={typeof to === 'string' ? to : (to?.pathname ?? '')} {...props}>
			{children}
		</a>
	),
	Form: ({ children, ...props }: FormProps) => (
		<form {...props}>{children}</form>
	),
}))

vi.mock('react-router', async () => {
	const actual =
		await vi.importActual<typeof import('react-router')>('react-router')
	return {
		...actual,
		useLoaderData: routerMocks.useLoaderData,
		Link: routerMocks.Link,
		Form: routerMocks.Form,
	}
})

vi.mock('#app/utils/user.ts', () => ({
	useOptionalUser: vi.fn(),
}))

const mockedUseOptionalUser = vi.mocked(useOptionalUser)
const mockedUseLoaderData = routerMocks.useLoaderData

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

test('The user profile when not logged in as self', async () => {
	const user = {
		id: 'user_1',
		username: 'harry',
		name: 'Harry Example',
		createdAt: new Date('2024-01-01T00:00:00Z'),
	}
	mockedUseOptionalUser.mockReturnValue(null)
	mockedUseLoaderData.mockReturnValue({
		user,
		userJoinedDisplay: user.createdAt.toLocaleDateString(),
	})
	render(<UserProfile />)

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
	mockedUseLoaderData.mockReturnValue({
		user,
		userJoinedDisplay: user.createdAt.toLocaleDateString(),
	})
	render(<UserProfile />)

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
