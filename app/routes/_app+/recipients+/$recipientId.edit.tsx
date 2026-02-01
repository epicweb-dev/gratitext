import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { RecipientEditor } from './__editor.tsx'

export { action } from './__editor.server.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipient = await prisma.recipient.findUnique({
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
			verified: true,
			disabled: true,
			userId: true,
		},
		where: {
			id: params.recipientId,
		},
	})
	if (!recipient || recipient.userId !== userId) {
		throw new Response('Not found', { status: 404 })
	}

	const supportedTimeZones = Intl.supportedValuesOf('timeZone')

	const { userId: _userId, ...recipientData } = recipient

	return json({ recipient: recipientData, supportedTimeZones })
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

	return (
		<RecipientEditor
			recipient={data.recipient}
			supportedTimeZones={data.supportedTimeZones}
		/>
	)
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
