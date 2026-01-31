import { invariantResponse } from '@epic-web/invariant'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatMessage } from '#app/utils/message-format.ts'
import { cn, useDelayedIsPending } from '#app/utils/misc.tsx'

const MESSAGES_PER_PAGE = 30

type MessageCursor = {
	sentAt: string
	id: string
}

type MessageItem = {
	id: string
	content: string
	sentAtDisplay: string
	sentAtIso: string
}

type MessagesPage = {
	messages: Array<MessageItem>
	nextCursor: MessageCursor | null
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const searchQuery = url.searchParams.get('search') ?? ''
	const recipientId = params.recipientId
	invariantResponse(recipientId, 'Invalid recipient', { status: 400 })

	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId, userId },
		select: {
			name: true,
			phoneNumber: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	// Build the where clause for messages
	const messageWhere = {
		recipientId,
		sentAt: { not: null },
		...(searchQuery ? { content: { contains: searchQuery } } : {}),
	}

	// Get total count for summary
	const totalMessages = await prisma.message.count({
		where: messageWhere,
	})

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
		recipient,
		recipientId,
		searchQuery,
		totalMessages,
		initialMessages: pageMessages.map((message) =>
			formatMessage({
				id: message.id,
				content: message.content,
				sentAt: message.sentAt!,
			}),
		),
		nextCursor,
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `Past Messages | ${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

function buildMessagesUrl({
	recipientId,
	searchQuery,
	cursor,
}: {
	recipientId: string
	searchQuery: string
	cursor: MessageCursor | null
}) {
	const params = new URLSearchParams()
	params.set('recipientId', recipientId)
	if (searchQuery) params.set('search', searchQuery)
	if (cursor) {
		params.set('cursorSentAt', cursor.sentAt)
		params.set('cursorId', cursor.id)
	}
	return `/resources/recipient-messages?${params.toString()}`
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
	})
	const topSentinelRef = useRef<HTMLDivElement | null>(null)
	const bottomRef = useRef<HTMLDivElement | null>(null)
	const hasAutoScrolledRef = useRef(false)

	const messagesQuery = useInfiniteQuery<
		MessagesPage,
		Error,
		InfiniteData<MessagesPage, MessageCursor | null>,
		[string, string, string],
		MessageCursor | null
	>({
		queryKey: ['recipient-messages', data.recipientId, data.searchQuery],
		initialPageParam: null as MessageCursor | null,
		queryFn: async ({ pageParam, signal }) => {
			const cursor = pageParam as MessageCursor | null
			const response = await fetch(
				buildMessagesUrl({
					recipientId: data.recipientId,
					searchQuery: data.searchQuery,
					cursor,
				}),
				{ signal },
			)
			if (!response.ok) {
				throw new Error('Failed to load messages')
			}
			return (await response.json()) as MessagesPage
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		initialData: {
			pages: [
				{
					messages: data.initialMessages,
					nextCursor: data.nextCursor,
				},
			],
			pageParams: [null],
		},
	})

	const messages = useMemo<Array<MessageItem>>(() => {
		const pages = messagesQuery.data?.pages ?? []
		return pages
			.slice()
			.reverse()
			.flatMap((page) => page.messages.slice().reverse())
	}, [messagesQuery.data?.pages])

	useEffect(() => {
		hasAutoScrolledRef.current = false
	}, [data.recipientId, data.searchQuery])

	useEffect(() => {
		if (hasAutoScrolledRef.current || messages.length === 0) return
		bottomRef.current?.scrollIntoView({ block: 'end' })
		hasAutoScrolledRef.current = true
	}, [messages.length, data.recipientId, data.searchQuery])

	useEffect(() => {
		const node = topSentinelRef.current
		if (!node || !messagesQuery.hasNextPage) return
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (
					entry?.isIntersecting &&
					messagesQuery.hasNextPage &&
					!messagesQuery.isFetchingNextPage
				) {
					void messagesQuery.fetchNextPage()
				}
			},
			{ rootMargin: '200px 0px' },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [
		messagesQuery.fetchNextPage,
		messagesQuery.hasNextPage,
		messagesQuery.isFetchingNextPage,
	])

	const emptyStateMessage = data.searchQuery
		? 'No messages match your search.'
		: 'No past messages yet.'
	const totalMessageLabel =
		data.totalMessages === 0
			? 'No messages found'
			: `Showing ${Math.min(messages.length, data.totalMessages).toLocaleString()} of ${data.totalMessages.toLocaleString()} message${data.totalMessages === 1 ? '' : 's'}`

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4">
				<SearchBar status="idle" autoSubmit />
				<p className="text-muted-foreground text-sm">
					{totalMessageLabel}
					{data.searchQuery ? (
						<>
							{' '}
							matching "<strong>{data.searchQuery}</strong>"
						</>
					) : null}
				</p>
			</div>

			{messages.length === 0 ? (
				<div className="text-muted-foreground py-8 text-center">
					{emptyStateMessage}
				</div>
			) : (
				<div
					className={cn('flex flex-col gap-4', {
						'opacity-50': isPending,
					})}
				>
					<div
						ref={topSentinelRef}
						className="text-muted-foreground flex items-center justify-center text-xs font-semibold tracking-[0.2em] uppercase"
					>
						{messagesQuery.isFetchingNextPage
							? 'Loading older messages...'
							: messagesQuery.hasNextPage
								? 'Scroll up to load older messages'
								: 'Start of conversation'}
					</div>
					<ul className="flex flex-col gap-4 sm:gap-5">
						{messages.map((message) => (
							<li key={message.id} className="flex flex-col items-end gap-2">
								<time
									dateTime={message.sentAtIso}
									className="text-muted-secondary-foreground text-[11px] font-semibold tracking-[0.2em] uppercase sm:text-xs"
								>
									{message.sentAtDisplay}
								</time>
								<div className="border-border bg-card text-foreground w-full max-w-[min(92%,36rem)] rounded-3xl border px-4 py-3 text-sm shadow-sm sm:text-base">
									<p className="break-words whitespace-pre-wrap">
										{message.content}
									</p>
								</div>
							</li>
						))}
					</ul>
					<div ref={bottomRef} />
				</div>
			)}
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
