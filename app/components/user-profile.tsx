import { Form, Link, useLoaderData } from 'react-router'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

export type UserProfileUser = {
	id: string
	name: string | null
	username: string
}

export type UserProfileLoaderData = {
	user: UserProfileUser
	userJoinedDisplay: string
}

export type UserProfileViewProps = {
	user: UserProfileUser
	userJoinedDisplay: string
	isLoggedInUser: boolean
}

export function UserProfileView({
	user,
	userJoinedDisplay,
	isLoggedInUser,
}: UserProfileViewProps) {
	const userDisplayName = user.name ?? user.username
	const initial = userDisplayName.trim().charAt(0).toUpperCase() || '?'

	return (
		<main className="container flex flex-1 items-center justify-center py-16 md:py-24">
			<div className="border-border bg-card flex w-full max-w-md flex-col items-center rounded-[32px] border px-6 py-10 text-center shadow-sm sm:px-10">
				<span
					aria-hidden="true"
					className="bg-primary text-primary-foreground flex h-20 w-20 items-center justify-center rounded-full font-serif text-3xl font-semibold"
				>
					{initial}
				</span>
				<h1 className="text-foreground mt-5 font-serif text-3xl font-semibold break-words sm:text-4xl">
					{userDisplayName}
				</h1>
				<p className="text-muted-foreground mt-1 text-sm">@{user.username}</p>
				<p className="text-muted-foreground mt-3 text-sm">
					Joined {userJoinedDisplay}
				</p>
				{isLoggedInUser ? (
					<div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
						<Button asChild variant="brand">
							<Link to="/recipients" prefetch="intent">
								<Icon name="message" size="sm" aria-hidden="true" />
								My recipients
							</Link>
						</Button>
						<Button asChild variant="secondary">
							<Link to="/settings/profile" prefetch="intent">
								<Icon name="settings" size="sm" aria-hidden="true" />
								Settings
							</Link>
						</Button>
					</div>
				) : null}
				{isLoggedInUser ? (
					<Form action="/logout" method="POST" className="mt-6">
						<Button type="submit" variant="ghost" size="sm">
							<Icon name="exit" size="sm" aria-hidden="true" />
							Logout
						</Button>
					</Form>
				) : null}
			</div>
		</main>
	)
}

export default function UserProfile() {
	const data = useLoaderData<UserProfileLoaderData>()
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = data.user.id === loggedInUser?.id

	return (
		<UserProfileView
			user={data.user}
			userJoinedDisplay={data.userJoinedDisplay}
			isLoggedInUser={isLoggedInUser}
		/>
	)
}
