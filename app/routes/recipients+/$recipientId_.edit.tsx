import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { RecipientEditor } from './__editor.tsx'

export { action } from './__editor.server.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipient = await prisma.recipient.findFirst({
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
			verified: true,
		},
		where: {
			id: params.recipientId,
			userId,
		},
	})
	invariantResponse(recipient, 'Not found', { status: 404 })

	return json({ recipient })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `Edit | ${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()

	return <RecipientEditor recipient={data.recipient} />
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
