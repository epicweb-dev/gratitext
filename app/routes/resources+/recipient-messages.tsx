import { invariantResponse } from '@epic-web/invariant'
import { data as json, type LoaderFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.js'
import { prisma } from '#app/utils/db.server.ts'
import { getPastMessagesPage } from '#app/utils/message-pagination.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const recipientId = url.searchParams.get('recipientId')
	invariantResponse(recipientId, 'Recipient is required', { status: 400 })

	const searchQuery = url.searchParams.get('search') ?? ''
	const startDateFilter = url.searchParams.get('startDate') ?? ''
	const endDateFilter = url.searchParams.get('endDate') ?? ''
	const cursor = url.searchParams.get('cursor')

	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId },
		select: { userId: true, timeZone: true },
	})

	if (!recipient || recipient.userId !== userId) {
		throw new Response('Not found', { status: 404 })
	}

	const hints = getHints(request)
	const filterTimeZone = hints.timeZone ?? recipient.timeZone
	const { pastMessages, nextCursor } = await getPastMessagesPage({
		recipientId,
		searchQuery,
		startDateFilter,
		endDateFilter,
		cursor,
		filterTimeZone,
	})

	return json({
		recipientId,
		searchQuery,
		startDateFilter,
		endDateFilter,
		pastMessages,
		nextCursor,
	})
}
