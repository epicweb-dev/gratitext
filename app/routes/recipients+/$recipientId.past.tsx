import { invariantResponse } from '@epic-web/invariant'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			name: true,
			phoneNumber: true,
			messages: {
				select: { id: true, content: true, sentAt: true, order: true },
				orderBy: { order: 'asc' },
				where: { sentAt: { not: null } },
			},
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const { messages, ...recipientProps } = recipient

	return json({
		recipient: recipientProps,
		messageCountDisplay: messages.length.toLocaleString(),
		pastMessages: messages
			.filter(m => m.sentAt)
			.sort((m1, m2) => m2.sentAt!.getTime() - m1.sentAt!.getTime())
			.map(m => ({
				id: m.id,
				sentAtDisplay: m.sentAt!.toLocaleDateString('en-US', {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: 'numeric',
					minute: 'numeric',
				}),
				content: m.content,
			})),
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `Past Messages | ${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div>
			<p className="mb-8">
				You have sent <strong>{data.messageCountDisplay}</strong>{' '}
				{data.pastMessages.length === 1 ? 'message' : 'messages'} to{' '}
				{data.recipient.name}.
			</p>
			<ul className="flex flex-col gap-2">
				{data.pastMessages.map(m => (
					<li
						key={m.id}
						className="flex flex-col justify-start gap-2 align-top lg:flex-row"
					>
						<span className="min-w-36 text-muted-secondary-foreground">
							{m.sentAtDisplay}
						</span>
						<span>{m.content}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No recipient with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
