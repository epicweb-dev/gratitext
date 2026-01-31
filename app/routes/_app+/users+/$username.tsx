import { invariantResponse } from '@epic-web/invariant'
import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import UserProfile, { type UserProfileLoaderData } from './user-profile.tsx'

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

	return json<UserProfileLoaderData>({
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
		},
		userJoinedDisplay: user.createdAt.toLocaleDateString(),
	})
}

export default function ProfileRoute() {
	return <UserProfile />
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
