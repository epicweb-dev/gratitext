import { invariantResponse } from '@epic-web/invariant'
import { data as json, type LoaderFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const MESSAGES_PER_PAGE = 30

type MessageCursor = {
	sentAt: Date
	id: string
}

function formatMessage(message: { id: string; content: string; sentAt: Date }) {
	return {
		id: message.id,
		content: message.content,
		sentAtIso: message.sentAt.toISOString(),
		sentAtDisplay: message.sentAt.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
		}),
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const recipientId = url.searchParams.get('recipientId')
	invariantResponse(recipientId, 'Missing recipient id', { status: 400 })
	const searchQuery = url.searchParams.get('search') ?? ''
	const cursorSentAt = url.searchParams.get('cursorSentAt')
	const cursorId = url.searchParams.get('cursorId')

	let cursor: MessageCursor | null = null
	if (cursorSentAt || cursorId) {
		invariantResponse(cursorSentAt && cursorId, 'Invalid cursor', {
			status: 400,
		})
		const sentAt = new Date(cursorSentAt ?? '')
		invariantResponse(!Number.isNaN(sentAt.getTime()), 'Invalid cursor date', {
			status: 400,
		})
		cursor = { sentAt, id: cursorId }
	}

	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId, userId },
		select: { id: true },
	})
	invariantResponse(recipient, 'Not found', { status: 404 })

	const messageWhere = {
		recipientId,
		sentAt: { not: null },
		...(searchQuery ? { content: { contains: searchQuery } } : {}),
		...(cursor
			? {
					OR: [
						{ sentAt: { lt: cursor.sentAt } },
						{ sentAt: cursor.sentAt, id: { lt: cursor.id } },
					],
				}
			: {}),
	}

	const messages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
		take: MESSAGES_PER_PAGE + 1,
	})

	const hasMore = messages.length > MESSAGES_PER_PAGE
	const pageMessages = messages.slice(0, MESSAGES_PER_PAGE)
	const lastMessage = pageMessages.at(-1)
	const nextCursor =
		hasMore && lastMessage?.sentAt
			? { sentAt: lastMessage.sentAt.toISOString(), id: lastMessage.id }
			: null

	return json({
		messages: pageMessages.map((message) =>
			formatMessage({
				id: message.id,
				content: message.content,
				sentAt: message.sentAt!,
			}),
		),
		nextCursor,
	})
}
