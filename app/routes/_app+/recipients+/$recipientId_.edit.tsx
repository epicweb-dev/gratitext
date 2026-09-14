import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
	useOutletContext,
} from 'react-router'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { formPageHandle } from '#app/components/form-page.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getTimeZoneOptions } from '#app/utils/time-zones.server.ts'
import { RecipientEditor } from './__editor.tsx'
import { getReservedDays } from './__reserved-days.ts'
import { type RecipientsOutletContext } from './_layout.tsx'

export { action } from './__editor.server.tsx'

export const handle = formPageHandle

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

	const { userId: _userId, ...recipientData } = recipient

	return json({ recipient: recipientData, timeZones: getTimeZoneOptions() })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `Edit | ${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

export default function RecipientEdit() {
	const data = useLoaderData<typeof loader>()
	const { recipients, subscriptionStatus } =
		useOutletContext<RecipientsOutletContext>()

	return (
		<RecipientEditor
			recipient={data.recipient}
			timeZones={data.timeZones}
			reservedDays={getReservedDays({
				recipients,
				subscriptionStatus,
				excludeRecipientId: data.recipient.id,
			})}
		/>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<ErrorMessage
						eyebrow="Error 404"
						title="Recipient not found"
						description={`No recipient with the id "${params.recipientId}" exists.`}
					/>
				),
			}}
		/>
	)
}
