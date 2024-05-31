import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { useOptionalUser } from '#app/utils/user.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			name: true,
			username: true,
			createdAt: true,
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })

	return json({ user, userJoinedDisplay: user.createdAt.toLocaleDateString() })
}

export default function ProfileRoute() {
	const data = useLoaderData<typeof loader>()
	const user = data.user
	const userDisplayName = user.name ?? user.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = data.user.id === loggedInUser?.id

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />
			<div className="flex flex-col items-center">
				<div className="flex flex-wrap items-center justify-center gap-4">
					<h1 className="text-center text-h2">{userDisplayName}</h1>
				</div>
				<p className="mt-2 text-center text-muted-foreground">
					Joined {data.userJoinedDisplay}
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
								<Link to="recipients" prefetch="intent">
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
							<Link to="recipients" prefetch="intent">
								{userDisplayName}'s recipients
							</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.name ?? params.username
	return [
		{ title: `${displayName} | GratiText` },
		{
			name: 'description',
			content: `Profile of ${displayName} on GratiText`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}
