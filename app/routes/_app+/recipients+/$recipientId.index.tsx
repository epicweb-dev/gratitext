import { getFormProps, getTextareaProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	Link,
	useFetcher,
	useLoaderData,
	useSearchParams,
} from 'react-router'
import { z } from 'zod'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.js'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.js'
import { CronParseError, getSendTime } from '#app/utils/cron.server.js'
import { prisma } from '#app/utils/db.server.ts'
import { formatThreadDate, formatThreadTime } from '#app/utils/format-date.ts'
import { cn } from '#app/utils/misc.tsx'
import { getSubscriptionTier } from '#app/utils/stripe.server.ts'
import { sendTextToRecipient } from '#app/utils/text.server.js'
import { createToastHeaders } from '#app/utils/toast.server.js'

type LoaderData = Awaited<ReturnType<typeof loader>>['data']
type FutureMessage = LoaderData['futureMessages'][number]

const PAST_MESSAGES_PER_PAGE = 30
/** Mirrors the per-day send allowance enforced in `sendTextToRecipient`. */
const DAILY_SEND_LIMIT = { none: 0, basic: 1, premium: 10 } as const

function parseDateValue(value: string) {
	if (!value) return null
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) return null
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	if (!year || !month || !day) return null
	return { year, month, day }
}

function getStartDate(value: string, timeZone: string) {
	const parts = parseDateValue(value)
	if (!parts) return null
	try {
		const start = getDateInTimeZone(
			parts.year,
			parts.month,
			parts.day,
			timeZone,
		)
		return Number.isNaN(start.getTime()) ? null : start
	} catch {
		return null
	}
}

function getEndDate(value: string, timeZone: string) {
	const parts = parseDateValue(value)
	if (!parts) return null
	try {
		const nextDay = new Date(
			Date.UTC(parts.year, parts.month - 1, parts.day + 1),
		)
		const end = getDateInTimeZone(
			nextDay.getUTCFullYear(),
			nextDay.getUTCMonth() + 1,
			nextDay.getUTCDate(),
			timeZone,
		)
		return Number.isNaN(end.getTime()) ? null : end
	} catch {
		return null
	}
}

function getDateInTimeZone(
	year: number,
	month: number,
	day: number,
	timeZone: string,
) {
	const utcDate = new Date(Date.UTC(year, month - 1, day))
	const offset = getTimeZoneOffset(utcDate, timeZone)
	return new Date(utcDate.getTime() - offset)
}

function getTimeZoneOffset(date: Date, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	})
	const parts = formatter.formatToParts(date)
	const values = Object.fromEntries(
		parts.map(({ type, value }) => [type, value]),
	)
	const asUTC = Date.UTC(
		Number(values.year),
		Number(values.month) - 1,
		Number(values.day),
		Number(values.hour),
		Number(values.minute),
		Number(values.second),
	)
	return asUTC - date.getTime()
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const url = new URL(request.url)
	const searchQuery = url.searchParams.get('search') ?? ''
	const startDateFilter = url.searchParams.get('startDate') ?? ''
	const endDateFilter = url.searchParams.get('endDate') ?? ''
	const cursor = url.searchParams.get('cursor')
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId },
		select: {
			scheduleCron: true,
			timeZone: true,
			userId: true,
			phoneNumber: true,
			messages: {
				select: { id: true, content: true, sentAt: true, order: true },
				orderBy: { order: 'asc' },
				where: { sentAt: null },
			},
		},
	})

	if (!recipient || recipient.userId !== userId) {
		throw new Response('Not found', { status: 404 })
	}

	const [optOut, user] = await Promise.all([
		prisma.optOut.findUnique({
			where: { phoneNumber: recipient.phoneNumber },
		}),
		prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { stripeId: true },
		}),
	])
	const subscriptionTier = await getSubscriptionTier(user.stripeId)
	const dailyLimit = DAILY_SEND_LIMIT[subscriptionTier]
	const sentInLastDay = dailyLimit
		? await prisma.message.count({
				where: {
					recipient: { userId },
					sentAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 23) },
				},
			})
		: 0
	const sendNow: { disabled: boolean; reason: string | null } =
		subscriptionTier === 'none'
			? { disabled: true, reason: 'Subscribe to send messages' }
			: sentInLastDay >= dailyLimit
				? { disabled: true, reason: "Today's limit reached" }
				: { disabled: false, reason: null }

	const startDate = getStartDate(
		startDateFilter,
		hints.timeZone ?? recipient.timeZone,
	)
	const endDate = getEndDate(
		endDateFilter,
		hints.timeZone ?? recipient.timeZone,
	)
	const sentAtFilter =
		startDate || endDate
			? {
					...(startDate ? { gte: startDate } : {}),
					...(endDate ? { lt: endDate } : {}),
				}
			: { not: null }
	const pastMessageWhere = {
		recipientId: params.recipientId,
		sentAt: sentAtFilter,
		...(searchQuery ? { content: { contains: searchQuery } } : {}),
	}
	const pastMessages = await prisma.message.findMany({
		where: pastMessageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
		...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
		take: PAST_MESSAGES_PER_PAGE + 1,
	})
	const hasMorePast = pastMessages.length > PAST_MESSAGES_PER_PAGE
	const pastPageMessages = hasMorePast
		? pastMessages.slice(0, PAST_MESSAGES_PER_PAGE)
		: pastMessages
	const nextCursor = hasMorePast
		? pastPageMessages[pastPageMessages.length - 1]?.id
		: null

	const { userId: _userId, messages, ...recipientProps } = recipient
	const displayTimeZone = hints.timeZone || recipient.timeZone

	return json({
		optedOut: Boolean(optOut),
		recipient: recipientProps,
		sendNow,
		searchQuery,
		startDateFilter,
		endDateFilter,
		nextCursor,
		cronError: (() => {
			try {
				getSendTime(recipient.scheduleCron, { tz: recipient.timeZone }, 0)
				return null
			} catch (error) {
				return error instanceof CronParseError ? error.message : 'Invalid cron'
			}
		})(),
		futureMessages: messages
			.sort((m1, m2) => m1.order - m2.order)
			.map((m, i, arr) => {
				const base = {
					id: m.id,
					content: m.content,
					order: m.order,
					earlierOrder: null,
					laterOrder: null,
					sendAtDisplay: null as string | null,
					sendAtTime: null as string | null,
				}
				if (optOut) return base

				try {
					const lastItem = arr[arr.length - 1]
					const oneBefore = arr[i - 1]?.order ?? 0
					const twoBefore = arr[i - 2]?.order ?? 0
					const oneAfter = arr[i + 1]?.order ?? (lastItem?.order ?? 0) + 1
					const twoAfter = arr[i + 2]?.order ?? (lastItem?.order ?? 0) + 1
					const isFirst = i === 0
					const isLast = i === arr.length - 1
					const earlierOrder = isFirst ? null : (oneBefore + twoBefore) / 2
					const laterOrder = isLast ? null : (oneAfter + twoAfter) / 2
					const sendAt = getSendTime(
						recipient.scheduleCron,
						{ tz: recipient.timeZone },
						i,
					)
					return {
						...base,
						earlierOrder,
						laterOrder,
						sendAtDisplay: formatThreadDate(sendAt, displayTimeZone),
						sendAtTime: formatThreadTime(sendAt, displayTimeZone),
					}
				} catch (error) {
					return {
						...base,
						sendAtDisplay:
							error instanceof CronParseError
								? `Invalid cron: ${error.cronString}`
								: 'Invalid schedule',
					}
				}
			}),
		pastMessages: pastPageMessages.map((m) => ({
			id: m.id,
			sentAtDisplay: formatThreadDate(m.sentAt!, displayTimeZone),
			sentAtTime: formatThreadTime(m.sentAt!, displayTimeZone),
			sentAtIso: m.sentAt!.toISOString(),
			content: m.content,
		})),
	})
}

type MessageActionArgs = {
	request: Request
	userId: string
	recipientId: string
	formData: FormData
}

const sendMessageActionIntent = 'send-message'
const deleteMessageActionIntent = 'delete-message'
const updateMessageOrderActionIntent = 'update-order-message'
const updateMessageContentActionIntent = 'update-content-message'

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const recipientId = params.recipientId
	invariantResponse(recipientId, 'Invalid recipient', { status: 400 })
	const formData = await request.formData()
	const intent = formData.get('intent')
	switch (intent) {
		case sendMessageActionIntent: {
			return sendMessageAction({ request, userId, recipientId, formData })
		}
		case deleteMessageActionIntent: {
			return deleteMessageAction({ request, userId, recipientId, formData })
		}
		case updateMessageContentActionIntent: {
			return updateMessageContentAction({
				request,
				userId,
				recipientId,
				formData,
			})
		}
		case updateMessageOrderActionIntent: {
			return updateMessageOrderAction({
				request,
				userId,
				recipientId,
				formData,
			})
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

const SendMessageSchema = z.object({ id: z.string() })
async function sendMessageAction({ formData, userId }: MessageActionArgs) {
	const submission = parseWithZod(formData, {
		schema: SendMessageSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { stripeId } = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { stripeId: true },
	})
	if (!stripeId) {
		return json(
			{
				result: submission.reply({
					formErrors: ['Please subscribe in settings'],
				}),
			},
			{ status: 400 },
		)
	}

	const data = submission.value

	const message = await prisma.message.findFirst({
		where: { id: data.id, recipient: { userId } },
		select: {
			id: true,
			recipient: { select: { id: true } },
		},
	})
	if (!message) {
		return json({
			result: submission.reply({ formErrors: ['Message not found'] }),
		})
	}

	const response = await sendTextToRecipient({
		messageId: message.id,
		recipientId: message.recipient.id,
	})
	if (response.status === 'error') {
		return json({
			result: submission.reply({ formErrors: [response.error] }),
		})
	}

	return json(
		{ result: submission.reply() },
		{
			status: 200,
			headers: await createToastHeaders({
				type: 'success',
				title: 'Message sent',
				description: 'Your message has been sent',
			}),
		},
	)
}

const DeleteMessageSchema = z.object({ id: z.string() })
async function deleteMessageAction({ formData }: MessageActionArgs) {
	const submission = parseWithZod(formData, {
		schema: DeleteMessageSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value
	await prisma.message.delete({ where: { id: data.id } })
	return json({ result: submission.reply() }, { status: 200 })
}

const UpdateMessageContentSchema = z.object({
	id: z.string(),
	content: z.string().min(1).max(5000),
})
async function updateMessageContentAction({ formData }: MessageActionArgs) {
	const submission = parseWithZod(formData, {
		schema: UpdateMessageContentSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value
	await prisma.message.update({
		where: { id: data.id },
		data: { content: data.content },
	})
	return json({ result: submission.reply() }, { status: 200 })
}

const UpdateMessageOrderSchema = z.object({
	id: z.string(),
	order: z.number().min(0),
})
async function updateMessageOrderAction({ formData }: MessageActionArgs) {
	const submission = parseWithZod(formData, {
		schema: UpdateMessageOrderSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value
	await prisma.message.update({
		where: { id: data.id },
		data: { order: data.order },
	})
	return json({ result: submission.reply() }, { status: 200 })
}

const bubbleClassName =
	'flex w-full flex-col gap-3 rounded-[1.25rem] px-5 py-4 text-base leading-relaxed md:max-w-[35rem] md:px-6 md:py-5'

/**
 * Sizes a textarea to its content without JS: an invisible replica of the
 * text sits in the same grid cell so the cell (and the textarea) grows with
 * it. Give the wrapper and the textarea the same font and padding classes.
 */
function GrowWrap({
	value,
	className,
	children,
}: {
	value: string
	className?: string
	children: ReactNode
}) {
	return (
		<div
			data-value={value}
			className={cn(
				"grid min-w-0 *:[grid-area:1/1/2/2] after:invisible after:whitespace-pre-wrap after:content-[attr(data-value)_'_'] after:[grid-area:1/1/2/2]",
				className,
			)}
		>
			{children}
		</div>
	)
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const newMessageFetcher = useFetcher<typeof action>()
	const isCreating = newMessageFetcher.state !== 'idle'
	const newMessageInputRef = useRef<HTMLTextAreaElement | null>(null)
	const shouldClearMessageInput = useRef(false)
	const [draft, setDraft] = useState('')
	const [searchParams] = useSearchParams()
	const loadMoreFetcher = useFetcher<typeof loader>()
	const loadMoreData = loadMoreFetcher.data ?? null
	const [pastMessages, setPastMessages] = useState(data.pastMessages)
	const [pastNextCursor, setPastNextCursor] = useState(data.nextCursor)
	const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
		null,
	)
	const pendingScrollRef = useRef<{ height: number; top: number } | null>(null)
	const shouldScrollToBottomRef = useRef(true)
	const isLoadingMore = loadMoreFetcher.state !== 'idle'
	const pastMessagesForDisplay = useMemo(
		() => [...pastMessages].reverse(),
		[pastMessages],
	)

	useEffect(() => {
		if (newMessageFetcher.state !== 'idle') {
			shouldClearMessageInput.current = true
			return
		}
		if (!shouldClearMessageInput.current) return

		const hasErrors = Boolean(newMessageFetcher.data?.result?.error)
		if (!hasErrors && newMessageInputRef.current) {
			newMessageInputRef.current.value = ''
			setDraft('')
		}
		shouldClearMessageInput.current = false
	}, [newMessageFetcher.state, newMessageFetcher.data])

	useEffect(() => {
		setPastMessages(data.pastMessages)
		setPastNextCursor(data.nextCursor)
		pendingScrollRef.current = null
		shouldScrollToBottomRef.current = true
	}, [
		data.pastMessages,
		data.nextCursor,
		data.searchQuery,
		data.startDateFilter,
		data.endDateFilter,
		data.recipient.phoneNumber,
	])

	useEffect(() => {
		if (!loadMoreData) return
		if (
			loadMoreData.recipient.phoneNumber !== data.recipient.phoneNumber ||
			loadMoreData.searchQuery !== data.searchQuery ||
			loadMoreData.startDateFilter !== data.startDateFilter ||
			loadMoreData.endDateFilter !== data.endDateFilter
		) {
			return
		}
		if (loadMoreData.pastMessages.length) {
			setPastMessages((prev) => {
				const existingIds = new Set(prev.map((message) => message.id))
				const newMessages = loadMoreData.pastMessages.filter(
					(message) => !existingIds.has(message.id),
				)
				return newMessages.length ? [...prev, ...newMessages] : prev
			})
		}
		setPastNextCursor(loadMoreData.nextCursor)
	}, [
		loadMoreData,
		data.recipient.phoneNumber,
		data.searchQuery,
		data.startDateFilter,
		data.endDateFilter,
	])

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
		container.scrollTop =
			pending.top + (container.scrollHeight - pending.height)
		pendingScrollRef.current = null
	}, [pastMessages, scrollContainer])

	const handleScroll = useCallback(
		(container: HTMLDivElement) => {
			if (container.scrollTop > 120) return
			if (!pastNextCursor) return
			if (shouldScrollToBottomRef.current) return
			if (loadMoreFetcher.state !== 'idle') return

			const params = new URLSearchParams(searchParams)
			params.set('cursor', pastNextCursor)
			const queryString = params.toString()
			pendingScrollRef.current = {
				height: container.scrollHeight,
				top: container.scrollTop,
			}
			void loadMoreFetcher.load(queryString ? `?${queryString}` : '.')
		},
		[pastNextCursor, loadMoreFetcher, searchParams],
	)

	useEffect(() => {
		const container = scrollContainer
		if (!container) return
		const onScroll = () => handleScroll(container)
		container.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			container.removeEventListener('scroll', onScroll)
		}
	}, [handleScroll, scrollContainer])

	const isPastFiltered = Boolean(
		data.searchQuery || data.startDateFilter || data.endDateFilter,
	)
	const hasPastMessages = pastMessagesForDisplay.length > 0
	const hasFutureMessages = data.futureMessages.length > 0
	const hasAnyMessages = hasPastMessages || hasFutureMessages
	const hasDraft = draft.trim().length > 0
	const newMessageErrors = newMessageFetcher.data?.result?.error
		? (newMessageFetcher.data.result.error.content ??
			newMessageFetcher.data.result.error[''] ??
			[])
		: null

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				ref={setScrollContainer}
				className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pt-5 md:pt-7"
			>
				{data.cronError ? (
					<div className="border-destructive/40 bg-destructive/10 text-foreground-destructive mb-4 rounded-2xl border p-4 text-sm">
						<strong className="font-semibold">Invalid schedule:</strong>{' '}
						{data.cronError}{' '}
						<Link to="edit" className="underline underline-offset-4">
							Update the schedule
						</Link>
					</div>
				) : null}
				{hasAnyMessages ? (
					<>
						{pastNextCursor ? (
							<p
								aria-live="polite"
								className="text-subtle-foreground mb-4 text-center text-xs"
							>
								{isLoadingMore
									? 'Loading earlier messages…'
									: 'Scroll up to load earlier messages'}
							</p>
						) : null}
						<ul className="flex flex-col gap-3 pb-4 md:items-end md:gap-4">
							{pastMessagesForDisplay.map((m) => (
								<li
									key={m.id}
									className={cn(
										bubbleClassName,
										'bg-sent text-sent-foreground md:w-fit',
									)}
								>
									<p className="flex items-center gap-3 text-sm">
										<Icon
											name="check"
											size="sm"
											className="shrink-0"
											aria-hidden="true"
										/>
										<span>
											Sent on{' '}
											<time dateTime={m.sentAtIso} title={m.sentAtTime}>
												{m.sentAtDisplay}
											</time>
										</span>
									</p>
									<p className="whitespace-pre-wrap">{m.content}</p>
								</li>
							))}
							{data.futureMessages.map((m) => (
								<MessageForms key={m.id} message={m} sendNow={data.sendNow} />
							))}
						</ul>
					</>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
						<span className="bg-card text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm">
							<Icon name="message" size="md" aria-hidden="true" />
						</span>
						<p className="text-foreground font-semibold">
							{isPastFiltered
								? 'No messages match your search.'
								: 'No messages yet.'}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{isPastFiltered
								? 'Try a different search or clear the filters to see everything.'
								: 'Write a short note of thanks below. It will be sent at the next scheduled time.'}
						</p>
					</div>
				)}
			</div>
			<div className="shrink-0 pt-2 pb-4 md:pb-6">
				<newMessageFetcher.Form method="POST" action="new">
					<label htmlFor="new-message" className="sr-only">
						Add a new message
					</label>
					<div className="bg-field border-border focus-within:border-ring flex items-end gap-2 rounded-[1.75rem] border p-1 pl-3 shadow-[0_8px_24px_-12px_rgba(24,36,48,0.12)] transition-colors md:pl-2">
						<GrowWrap
							value={draft}
							className="flex-1 self-center after:max-h-[12.5rem] after:px-3 after:py-3 after:text-sm after:leading-6"
						>
							<textarea
								id="new-message"
								name="content"
								ref={newMessageInputRef}
								placeholder="Aa"
								rows={1}
								required
								onInput={(event) => setDraft(event.currentTarget.value)}
								onKeyDown={(event) => {
									if (
										event.key === 'Enter' &&
										!event.shiftKey &&
										!event.nativeEvent.isComposing
									) {
										event.preventDefault()
										event.currentTarget.form?.requestSubmit()
									}
								}}
								className="text-field-foreground placeholder:text-subtle-foreground max-h-[12.5rem] min-h-12 w-full resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-6 focus-visible:outline-none"
							/>
						</GrowWrap>
						<StatusButton
							status={isCreating ? 'pending' : 'idle'}
							type="submit"
							variant="brand"
							disabled={!hasDraft || isCreating}
							className="h-12 shrink-0 gap-2 px-5 text-sm"
						>
							<Icon name="check" size="sm" aria-hidden="true" />
							<span className="hidden sm:inline">Add to Queue</span>
							<span className="sm:hidden">Add</span>
						</StatusButton>
					</div>
				</newMessageFetcher.Form>
				{newMessageErrors ? (
					<div className="px-4 pt-2">
						<ErrorList errors={newMessageErrors} />
					</div>
				) : null}
			</div>
		</div>
	)
}

function MessageForms({
	message,
	sendNow,
}: {
	message: FutureMessage
	sendNow: LoaderData['sendNow']
}) {
	const updateContentFetcher = useFetcher<typeof updateMessageContentAction>()
	const sendNowFetcher = useFetcher<typeof action>()
	const deleteFetcher = useFetcher<typeof action>()
	const deleteSafeDelayMs = 150
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [canDelete, setCanDelete] = useState(false)
	const [currentContent, setCurrentContent] = useState(message.content)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const [updateContentForm, updateContentFields] = useForm({
		id: `message-form-${message.id}`,
		constraint: getZodConstraint(UpdateMessageContentSchema),
		defaultValue: { id: message.id, content: message.content },
		lastResult: updateContentFetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: UpdateMessageContentSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	const scheduleLabel = message.sendAtDisplay ? (
		<>
			Scheduled for{' '}
			<time title={message.sendAtTime ?? undefined}>
				{message.sendAtDisplay}
			</time>
		</>
	) : (
		'Scheduled message'
	)
	const sendErrors = getResultErrors(sendNowFetcher.data?.result)
	const deleteErrors = getResultErrors(deleteFetcher.data?.result)
	const updateIsPending = updateContentFetcher.state !== 'idle'
	const sendIsPending = sendNowFetcher.state !== 'idle'
	const deleteIsPending = deleteFetcher.state !== 'idle'
	const textareaProps = getTextareaProps(updateContentFields.content)
	const hasEdits = currentContent !== message.content
	const showSaveButton = hasEdits || updateIsPending

	useEffect(() => {
		if (confirmDelete) {
			const timeout = setTimeout(() => {
				setCanDelete(true)
			}, deleteSafeDelayMs)
			return () => clearTimeout(timeout)
		}
		setCanDelete(false)
	}, [confirmDelete, deleteSafeDelayMs])

	const handleSendNow = () => {
		setConfirmDelete(false)
		const formData = new FormData()
		formData.set('intent', sendMessageActionIntent)
		formData.set('id', message.id)
		void sendNowFetcher.submit(formData, { method: 'POST' })
	}

	const handleEditMessage = () => {
		setConfirmDelete(false)
		setTimeout(() => textareaRef.current?.focus(), 0)
	}

	const handleDeleteSelect = (event: Event) => {
		if (!confirmDelete) {
			event.preventDefault()
			setConfirmDelete(true)
			return
		}
		if (!canDelete) {
			event.preventDefault()
			return
		}
		const formData = new FormData()
		formData.set('intent', deleteMessageActionIntent)
		formData.set('id', message.id)
		void deleteFetcher.submit(formData, { method: 'POST' })
		setConfirmDelete(false)
	}

	const errors = [
		...(updateContentForm.errors ?? []),
		...(updateContentFields.content.errors ?? []),
		...(sendErrors ?? []),
		...(deleteErrors ?? []),
	]

	return (
		<li className="flex w-full flex-col items-end gap-1 md:max-w-[35rem]">
			<div
				className={cn(
					bubbleClassName,
					'bg-scheduled text-scheduled-foreground gap-2 pt-2.5 md:pt-3',
				)}
			>
				<div className="flex items-center justify-between gap-3 text-sm">
					<p className="flex min-w-0 items-center gap-3 py-1.5">
						<Icon
							name="clock"
							size="sm"
							className="shrink-0"
							aria-hidden="true"
						/>
						<span>{scheduleLabel}</span>
					</p>
					<div className="-mr-3 flex shrink-0 items-center gap-0.5">
						{showSaveButton ? (
							<StatusButton
								form={updateContentForm.id}
								status={updateIsPending ? 'pending' : 'idle'}
								className="h-9 w-9 gap-0 text-current"
								size="icon"
								variant="ghost-inverse"
								type="submit"
								name="intent"
								value={updateMessageContentActionIntent}
							>
								<Icon name="check" size="sm" />
								<span className="sr-only">Save</span>
							</StatusButton>
						) : null}
						<DropdownMenu
							onOpenChange={(open) => {
								if (!open) setConfirmDelete(false)
							}}
						>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost-inverse"
									size="icon"
									className="h-9 w-9 text-current hover:bg-white/15"
									aria-label="Message actions"
								>
									<Icon name="dots-horizontal" size="sm" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								sideOffset={2}
								className="w-64 rounded-[1.25rem] p-2"
							>
								<DropdownMenuItem
									className="gap-3 px-3 py-2.5 text-sm"
									disabled={sendIsPending || sendNow.disabled}
									onSelect={handleSendNow}
								>
									<Icon
										name="send"
										size="sm"
										className="text-muted-foreground shrink-0"
										aria-hidden="true"
									/>
									<span className="flex flex-col">
										Send Now
										{sendNow.reason ? (
											<span className="text-muted-foreground text-xs font-normal">
												{sendNow.reason}
											</span>
										) : null}
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									className="gap-3 px-3 py-2.5 text-sm"
									onSelect={handleEditMessage}
								>
									<Icon
										name="pencil-1"
										size="sm"
										className="text-muted-foreground shrink-0"
										aria-hidden="true"
									/>
									Edit Message
								</DropdownMenuItem>
								<DropdownMenuItem
									className={cn(
										'gap-3 px-3 py-2.5 text-sm',
										confirmDelete &&
											'text-foreground-destructive focus:text-foreground-destructive',
									)}
									disabled={deleteIsPending}
									onSelect={handleDeleteSelect}
								>
									<Icon
										name={confirmDelete ? 'check' : 'trash'}
										size="sm"
										className={cn(
											'shrink-0',
											confirmDelete ? '' : 'text-muted-foreground',
										)}
										aria-hidden="true"
									/>
									{confirmDelete ? 'Confirm delete' : 'Delete'}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<updateContentFetcher.Form
					method="POST"
					{...getFormProps(updateContentForm)}
				>
					<input type="hidden" name="id" value={message.id} />
					<label htmlFor={updateContentFields.content.id} className="sr-only">
						Message content
					</label>
					<GrowWrap
						value={currentContent}
						className="-mx-1 after:px-1 after:text-base after:leading-relaxed"
					>
						<textarea
							{...textareaProps}
							onInput={(event) => {
								setCurrentContent(event.currentTarget.value)
							}}
							ref={textareaRef}
							rows={1}
							className="text-scheduled-foreground placeholder:text-scheduled-foreground/70 focus-visible:ring-scheduled-foreground/60 block w-full resize-none overflow-hidden rounded-lg bg-transparent px-1 text-base leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
						/>
					</GrowWrap>
				</updateContentFetcher.Form>
			</div>
			{errors.length ? (
				<div className="px-3">
					<ErrorList id={updateContentForm.errorId} errors={errors} />
				</div>
			) : null}
		</li>
	)
}

function getResultErrors(
	result:
		| { error?: Record<string, Array<string | null | undefined> | null> }
		| null
		| undefined,
) {
	if (!result?.error) return null
	return Object.values(result.error).flat().filter(Boolean)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => (
					<ErrorMessage
						eyebrow="Error 403"
						title="You are not allowed to do that"
					/>
				),
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
