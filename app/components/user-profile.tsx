import { Form, Link, useLoaderData } from 'react-router'
import { Spacer } from '#app/components/spacer.tsx'
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

	return (
		<div className="container mt-36 mb-48 flex flex-col items-center justify-center">
			<Spacer size="4xs" />
			<div className="flex flex-col items-center">
				<div className="flex flex-wrap items-center justify-center gap-4">
					<h1 className="text-h2 text-center">{userDisplayName}</h1>
				</div>
				<p className="text-muted-foreground mt-2 text-center">
					Joined {userJoinedDisplay}
				</p>
				{isLoggedInUser ? (
					<Form action="/logout" method="POST" className="mt-3">
						<Button type="submit" variant="link" size="pill">
							<Icon name="exit" className="scale-125 max-md:scale-150">
								Logout
							</Icon>
						</Button>
					</Form>
				) : null}
				<div className="mt-10 flex gap-4">
					{isLoggedInUser ? (
						<>
							<Button asChild>
								<Link to="/recipients" prefetch="intent">
									My recipients
								</Link>
							</Button>
							<Button asChild>
								<Link to="/settings/profile" prefetch="intent">
									Edit profile
								</Link>
							</Button>
						</>
					) : (
						<Button asChild>
							<Link to="/recipients" prefetch="intent">
								{userDisplayName}'s recipients
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
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
