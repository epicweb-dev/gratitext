import { invariantResponse } from '@epic-web/invariant'
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useFetcher,
	useLoaderData,
	useSearchParams,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const MESSAGES_PER_PAGE = 30

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const searchQuery = url.searchParams.get('search') ?? ''
	const cursor = url.searchParams.get('cursor')

	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			name: true,
			phoneNumber: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	// Build the where clause for messages
	const messageWhere = {
		recipientId: params.recipientId,
		sentAt: { not: null },
		...(searchQuery ? { content: { contains: searchQuery } } : {}),
	}

	// Get paginated messages (cursor-based)
	const messages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		take: MESSAGES_PER_PAGE + 1,
	})
	const hasMore = messages.length > MESSAGES_PER_PAGE
	const pageMessages = hasMore ? messages.slice(0, MESSAGES_PER_PAGE) : messages
	const nextCursor = hasMore ? pageMessages[pageMessages.length - 1]?.id : null

	return json({
		recipient,
		searchQuery,
		nextCursor,
		pastMessages: pageMessages.map((m) => ({
			id: m.id,
			sentAtDisplay: m.sentAt!.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: 'numeric',
			}),
			sentAtIso: m.sentAt!.toISOString(),
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

type LoaderData = Awaited<ReturnType<typeof loader>>['data']

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const loadMoreFetcher = useFetcher<LoaderData>()
	const loadMoreData = loadMoreFetcher.data
	const [messages, setMessages] = useState(data.pastMessages)
	const [nextCursor, setNextCursor] = useState(data.nextCursor)
	const [scrollContainer, setScrollContainer] =
		useState<HTMLDivElement | null>(null)
	const pendingScrollRef = useRef<{ height: number; top: number } | null>(null)
	const shouldScrollToBottomRef = useRef(true)
	const isLoadingMore = loadMoreFetcher.state !== 'idle'
	const messagesForDisplay = useMemo(() => [...messages].reverse(), [messages])

	useEffect(() => {
		setMessages(data.pastMessages)
		setNextCursor(data.nextCursor)
		pendingScrollRef.current = null
		shouldScrollToBottomRef.current = true
	}, [
		data.pastMessages,
		data.nextCursor,
		data.searchQuery,
		data.recipient.phoneNumber,
	])

	useEffect(() => {
		if (!loadMoreData) return
		if (loadMoreData.pastMessages.length) {
			setMessages((prev) => [...prev, ...loadMoreData.pastMessages])
		}
		setNextCursor(loadMoreData.nextCursor)
	}, [loadMoreData])

	useLayoutEffect(() => {
		const container = scrollContainer
		if (!container) return
		if (shouldScrollToBottomRef.current) {
			container.scrollTop = container.scrollHeight
			shouldScrollToBottomRef.current = false
			return
		}
		const pending = pendingScrollRef.current
		if (!pending) return
		container.scrollTop = pending.top + (container.scrollHeight - pending.height)
		pendingScrollRef.current = null
	}, [messages, scrollContainer])

	const handleScroll = useCallback((container: HTMLDivElement) => {
		if (container.scrollTop > 120) return
		if (!nextCursor) return
		if (shouldScrollToBottomRef.current) return
		if (loadMoreFetcher.state !== 'idle') return

		const params = new URLSearchParams(searchParams)
		params.set('cursor', nextCursor)
		const queryString = params.toString()
		pendingScrollRef.current = {
			height: container.scrollHeight,
			top: container.scrollTop,
		}
		loadMoreFetcher.load(queryString ? `?${queryString}` : '.')
	}, [nextCursor, loadMoreFetcher, searchParams])

	useEffect(() => {
		const container = scrollContainer
		if (!container) return
		const onScroll = () => handleScroll(container)
		container.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			container.removeEventListener('scroll', onScroll)
		}
	}, [handleScroll, scrollContainer])

	const emptyMessage = data.searchQuery
		? 'No messages match your search.'
		: 'No past messages yet.'
	const loadMoreLabel = nextCursor
		? isLoadingMore
			? 'Loading earlier messages...'
			: 'Scroll up to load earlier messages.'
		: 'Beginning of thread.'

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4">
				<SearchBar status="idle" autoSubmit />
			</div>

			<div className="border-border bg-card rounded-3xl border px-4 py-5 shadow-sm sm:px-6 sm:py-6">
				{messagesForDisplay.length === 0 ? (
					<p className="text-muted-foreground py-10 text-center text-sm">
						{emptyMessage}
					</p>
				) : (
					<div
						ref={setScrollContainer}
						className="border-border/60 bg-muted max-h-[65vh] overflow-y-auto rounded-[24px] border px-4 py-5 sm:px-5 sm:py-6"
					>
						<div className="flex flex-col gap-4">
							<div className="text-muted-foreground flex flex-col items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
								<span aria-live="polite">{loadMoreLabel}</span>
							</div>
							<ul className="flex flex-col gap-4 sm:gap-5">
								{messagesForDisplay.map((m) => (
									<li key={m.id} className="flex flex-col items-end gap-1">
										<div className="bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] max-w-[75%] rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[65%] sm:px-5 sm:py-4">
											<p className="whitespace-pre-wrap">{m.content}</p>
										</div>
										<time
											dateTime={m.sentAtIso}
											className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.2em] uppercase"
										>
											{m.sentAtDisplay}
										</time>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}
			</div>
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
