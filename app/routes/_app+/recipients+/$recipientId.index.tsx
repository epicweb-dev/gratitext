import { getFormProps, getTextareaProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
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
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	Link,
	useFetcher,
	useLoaderData,
	useSearchParams,
} from 'react-router'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.js'
import { SearchBar } from '#app/components/search-bar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.js'
import {
	CronParseError,
	formatSendTime,
	getSendTime,
} from '#app/utils/cron.server.js'
import { prisma } from '#app/utils/db.server.ts'
import { getPastMessagesPage } from '#app/utils/message-pagination.server.ts'
import { sendTextToRecipient } from '#app/utils/text.server.js'
import { createToastHeaders } from '#app/utils/toast.server.js'

type LoaderData = Awaited<ReturnType<typeof loader>>['data']
type FutureMessage = LoaderData['futureMessages'][number]
type PastMessage = LoaderData['pastMessages'][number]
type PastMessagesResponse = {
	recipientId: string
	searchQuery: string
	startDateFilter: string
	endDateFilter: string
	pastMessages: Array<PastMessage>
	nextCursor: string | null
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const recipientId = params.recipientId
	invariantResponse(recipientId, 'Invalid recipient', { status: 400 })
	const url = new URL(request.url)
	const searchQuery = url.searchParams.get('search') ?? ''
	const startDateFilter = url.searchParams.get('startDate') ?? ''
	const endDateFilter = url.searchParams.get('endDate') ?? ''
	const cursor = url.searchParams.get('cursor')
	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId },
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

	const optOut = await prisma.optOut.findUnique({
		where: { phoneNumber: recipient.phoneNumber },
	})

	const filterTimeZone = hints.timeZone ?? recipient.timeZone
	const { pastMessages, nextCursor } = await getPastMessagesPage({
		recipientId,
		searchQuery,
		startDateFilter,
		endDateFilter,
		cursor,
		filterTimeZone,
	})

	const { userId: _userId, messages, ...recipientProps } = recipient

	return json({
		optedOut: Boolean(optOut),
		recipient: recipientProps,
		recipientId,
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
					const sendAtDisplay = formatSendTime(
						getSendTime(recipient.scheduleCron, { tz: recipient.timeZone }, i),
						hints.timeZone || recipient.timeZone,
					)
					return {
						...base,
						earlierOrder,
						laterOrder,
						sendAtDisplay,
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
		pastMessages,
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

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const newMessageFetcher = useFetcher<typeof action>()
	const isCreating = newMessageFetcher.state !== 'idle'
	const newMessageInputRef = useRef<HTMLTextAreaElement | null>(null)
	const shouldClearMessageInput = useRef(false)
	const [searchParams] = useSearchParams()
	const loadMoreFetcher = useFetcher<PastMessagesResponse>()
	const loadMoreData = loadMoreFetcher.data ?? null
	const recipientId = data.recipientId
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
		data.recipientId,
	])

	useEffect(() => {
		if (!loadMoreData) return
		if (
			loadMoreData.recipientId !== data.recipientId ||
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
		data.recipientId,
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
			if (!recipientId) return

			const params = new URLSearchParams(searchParams)
			params.set('recipientId', recipientId)
			params.set('cursor', pastNextCursor)
			const queryString = params.toString()
			pendingScrollRef.current = {
				height: container.scrollHeight,
				top: container.scrollTop,
			}
			void loadMoreFetcher.load(
				`/resources/recipient-messages?${queryString}`,
			)
		},
		[pastNextCursor, loadMoreFetcher, recipientId, searchParams],
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
	const emptyThreadMessage = isPastFiltered
		? 'No messages match your search.'
		: 'No messages yet.'
	const loadMoreLabel = pastNextCursor
		? isLoadingMore
			? 'Loading earlier messages...'
			: 'Scroll up to load earlier messages.'
		: 'Beginning of thread.'

	return (
		<div className="flex flex-col gap-10">
			{data.cronError ? (
				<div className="border-destructive/40 bg-destructive/10 text-foreground-destructive rounded-2xl border p-4 text-sm">
					<strong className="font-semibold">Invalid Schedule:</strong>{' '}
					{data.cronError}{' '}
					<Link to="edit" className="underline">
						Update the schedule
					</Link>
				</div>
			) : null}
			<section className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-foreground text-xs font-semibold tracking-[0.2em] uppercase">
						Messages
					</h3>
				</div>
				<SearchBar status="idle" autoSubmit showDateFilter />
				{hasAnyMessages ? (
					<div
						ref={setScrollContainer}
						className="thread-gradient max-h-[65vh] overflow-y-auto px-4 py-5 sm:px-5 sm:py-6"
					>
						{hasPastMessages || pastNextCursor ? (
							<div className="text-muted-foreground flex flex-col items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
								<span aria-live="polite">{loadMoreLabel}</span>
							</div>
						) : null}
						<ul className="flex flex-col gap-4 sm:gap-5">
							{pastMessagesForDisplay.map((m) => (
								<li key={m.id} className="flex flex-col items-end gap-1">
									<div className="bg-message-bubble text-message-bubble-foreground max-w-[75%] rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[65%] sm:px-5 sm:py-4">
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
							{data.futureMessages.map((m) => (
								<MessageForms key={m.id} message={m} />
							))}
						</ul>
					</div>
				) : (
					<div className="thread-gradient px-4 py-10 text-center text-sm sm:px-5 sm:py-12">
						<p className="text-muted-foreground">{emptyThreadMessage}</p>
						<Link
							to="new"
							className="text-foreground text-sm font-semibold underline"
						>
							Create a new message
						</Link>
					</div>
				)}
			</section>
			<div className="flex flex-col gap-2 pb-8 sm:pb-10">
				<newMessageFetcher.Form
					method="POST"
					action="new"
					className="border-border/40 bg-card focus-within:border-border/60 rounded-full border p-2 shadow-sm transition focus-within:rounded-[28px] focus-within:shadow-md"
				>
					<label htmlFor="new-message" className="sr-only">
						Add a new message
					</label>
					<div className="flex items-center gap-2">
						<textarea
							id="new-message"
							name="content"
							ref={newMessageInputRef}
							placeholder="Aa"
							className="text-foreground placeholder:text-muted-foreground min-h-[48px] flex-1 resize-none rounded-full bg-transparent px-4 py-2 text-sm leading-relaxed focus-visible:outline-none"
							rows={1}
							required
						/>
						<StatusButton
							status={isCreating ? 'pending' : 'idle'}
							type="submit"
							size="pill"
							variant="brand-soft"
							className="shrink-0 px-6"
						>
							<Icon name="check">Add</Icon>
						</StatusButton>
					</div>
				</newMessageFetcher.Form>
				{newMessageFetcher.data?.result?.error ? (
					<ErrorList
						errors={
							newMessageFetcher.data.result.error.content ??
							newMessageFetcher.data.result.error[''] ??
							[]
						}
					/>
				) : null}
			</div>
		</div>
	)
}

function MessageForms({ message }: { message: FutureMessage }) {
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
	const cardTone = 'bg-message-card'
	const scheduleLabel = message.sendAtDisplay
		? `Scheduled for ${message.sendAtDisplay}`
		: 'Scheduled message'
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

	return (
		<li className="flex flex-col items-end gap-2">
			<div
				className={`text-message-card-foreground max-w-[75%] rounded-[24px] px-4 py-3 shadow-sm sm:max-w-[65%] sm:px-5 sm:py-4 ${cardTone}`}
			>
				<div className="text-message-card-foreground flex items-start justify-between gap-4 text-[0.7rem] font-semibold tracking-[0.2em] uppercase">
					<div className="flex items-center gap-2">
						<Icon name="clock" size="sm" />
						<span>{scheduleLabel}</span>
					</div>
					<div className="flex items-center gap-1">
						{showSaveButton ? (
							<StatusButton
								form={updateContentForm.id}
								status={updateIsPending ? 'pending' : 'idle'}
								className="h-9 w-9 gap-0"
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
									className="h-9 w-9"
									aria-label="Message actions"
								>
									<Icon name="dots-horizontal" size="sm" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="border-border/70 bg-card w-48 rounded-2xl p-2 shadow-lg"
							>
								<DropdownMenuItem
									className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
									disabled={sendIsPending}
									onSelect={handleSendNow}
								>
									<Icon name="send" size="sm" />
									Send Now
								</DropdownMenuItem>
								<DropdownMenuItem
									className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
									onSelect={handleEditMessage}
								>
									<Icon name="pencil-1" size="sm" />
									Edit Message
								</DropdownMenuItem>
								<DropdownMenuSeparator className="bg-border/60" />
								<DropdownMenuItem
									className="text-foreground-destructive focus:text-foreground-destructive flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
									disabled={deleteIsPending}
									onSelect={handleDeleteSelect}
								>
									<Icon name={confirmDelete ? 'check' : 'trash'} size="sm" />
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
					<textarea
						{...textareaProps}
						onInput={(event) => {
							setCurrentContent(event.currentTarget.value)
						}}
						ref={textareaRef}
						className="text-message-card-foreground placeholder:text-message-card-foreground/80 mt-2 w-full resize-none bg-transparent text-sm leading-relaxed focus-visible:outline-none"
						rows={2}
					/>
				</updateContentFetcher.Form>
			</div>
			<div className="flex w-full max-w-[75%] flex-col gap-1 self-end empty:hidden sm:max-w-[65%]">
				<ErrorList
					id={updateContentForm.errorId}
					errors={updateContentForm.errors}
				/>
				<ErrorList
					id={updateContentFields.content.errorId}
					errors={updateContentFields.content.errors}
				/>
				<ErrorList errors={sendErrors} />
				<ErrorList errors={deleteErrors} />
			</div>
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
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No recipient with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
