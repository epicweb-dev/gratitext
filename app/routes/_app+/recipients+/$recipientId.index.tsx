import { getFormProps, getTextareaProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import { useRef, useState } from 'react'
import {
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	Link,
	useFetcher,
	useLoaderData,
} from 'react-router'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.js'
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
import { sendTextToRecipient } from '#app/utils/text.server.js'
import { createToastHeaders } from '#app/utils/toast.server.js'

type LoaderData = Awaited<ReturnType<typeof loader>>['data']
type FutureMessage = LoaderData['futureMessages'][number]

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			scheduleCron: true,
			timeZone: true,
			phoneNumber: true,
			messages: {
				select: { id: true, content: true, sentAt: true, order: true },
				orderBy: { order: 'asc' },
				where: { sentAt: null },
			},
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const optOut = await prisma.optOut.findUnique({
		where: { phoneNumber: recipient.phoneNumber },
	})

	const { messages, ...recipientProps } = recipient

	return json({
		optedOut: Boolean(optOut),
		recipient: recipientProps,
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

	await prisma.message.update({
		where: { id: data.id },
		data: { sentAt: new Date() },
	})

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

	return (
		<div className="flex flex-col gap-8">
			{data.cronError ? (
				<div className="border-destructive/40 bg-destructive/10 text-foreground-destructive rounded-2xl border p-4 text-sm">
					<strong className="font-semibold">Invalid Schedule:</strong>{' '}
					{data.cronError}{' '}
					<Link to="edit" className="underline">
						Update the schedule
					</Link>
				</div>
			) : null}
			<ul className="flex flex-col gap-4 sm:gap-6">
				{data.futureMessages.length ? (
					data.futureMessages.map((m, index) => (
						<li key={m.id} className="flex flex-col gap-3 sm:gap-4">
							<MessageForms message={m} index={index} />
						</li>
					))
				) : (
					<Link
						to="new"
						className="text-foreground text-sm font-semibold underline"
					>
						Create a new message
					</Link>
				)}
			</ul>
			<div className="flex flex-col gap-2">
				<newMessageFetcher.Form
					method="POST"
					action="new"
					className="border-border bg-card rounded-full border p-2 shadow-sm transition focus-within:rounded-[28px] focus-within:p-3"
				>
					<label htmlFor="new-message" className="sr-only">
						Add a new message
					</label>
					<div className="flex items-center gap-3">
						<textarea
							id="new-message"
							name="content"
							placeholder="Aa"
							className="text-foreground placeholder:text-muted-foreground min-h-[44px] flex-1 resize-none rounded-full bg-transparent px-4 py-2 text-sm leading-relaxed focus-visible:outline-none"
							rows={1}
							required
						/>
						<StatusButton
							status={isCreating ? 'pending' : 'idle'}
							type="submit"
							size="pill"
							className="shrink-0 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
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

function MessageForms({
	message,
	index,
}: {
	message: FutureMessage
	index: number
}) {
	const updateContentFetcher = useFetcher<typeof updateMessageContentAction>()
	const sendNowFetcher = useFetcher<typeof action>()
	const deleteFetcher = useFetcher<typeof action>()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const formRef = useRef<HTMLFormElement | null>(null)
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
	const isPrimary = index % 2 === 0
	const cardTone = isPrimary
		? 'bg-[hsl(var(--palette-green-500))]'
		: 'bg-[hsl(var(--palette-blues))]'
	const headerText = message.sendAtDisplay
		? `Scheduled for ${message.sendAtDisplay}`
		: 'Message'
	const sendErrors = getResultErrors(sendNowFetcher.data?.result)
	const deleteErrors = getResultErrors(deleteFetcher.data?.result)
	const updateIsPending = updateContentFetcher.state !== 'idle'
	const sendIsPending = sendNowFetcher.state !== 'idle'
	const deleteIsPending = deleteFetcher.state !== 'idle'
	const textareaProps = getTextareaProps(updateContentFields.content)

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
		const formData = new FormData()
		formData.set('intent', deleteMessageActionIntent)
		formData.set('id', message.id)
		void deleteFetcher.submit(formData, { method: 'POST' })
		setConfirmDelete(false)
	}

	return (
		<div className="flex flex-col gap-3 sm:gap-4">
			<div className="flex-1 space-y-3">
				<div
					className={`rounded-[28px] px-4 py-4 text-[hsl(var(--palette-cream))] shadow-sm sm:px-6 sm:py-5 ${cardTone}`}
				>
					<div className="flex flex-col gap-3 text-xs font-semibold tracking-[0.15em] text-[hsl(var(--palette-cream))] uppercase sm:flex-row sm:items-center sm:justify-between sm:tracking-[0.2em]">
						<div className="flex flex-wrap items-center gap-2">
							<Icon name={isPrimary ? 'check' : 'clock'} size="sm" />
							<span>{headerText}</span>
						</div>
						<div className="flex items-center gap-2">
							<StatusButton
								form={updateContentForm.id}
								status={updateIsPending ? 'pending' : 'idle'}
								className="h-11 w-11 gap-0 text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-cream))/0.15] sm:h-10 sm:w-10"
								size="icon"
								variant="ghost"
								type="submit"
								name="intent"
								value={updateMessageContentActionIntent}
							>
								<Icon name="check" size="sm" />
								<span className="sr-only">Save</span>
							</StatusButton>
							<DropdownMenu
								onOpenChange={(open) => {
									if (!open) setConfirmDelete(false)
								}}
							>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-11 w-11 text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-cream))/0.15] sm:h-10 sm:w-10"
										aria-label="Message actions"
									>
										<Icon name="dots-horizontal" size="sm" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-48 rounded-2xl border-border/70 bg-card p-2 shadow-lg"
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
						ref={formRef}
						method="POST"
						{...getFormProps(updateContentForm)}
					>
						<input type="hidden" name="id" value={message.id} />
						<label htmlFor={updateContentFields.content.id} className="sr-only">
							Message content
						</label>
						<textarea
							{...textareaProps}
							ref={textareaRef}
							className="mt-4 w-full resize-none bg-transparent text-sm leading-relaxed text-[hsl(var(--palette-cream))] placeholder:text-[hsl(var(--palette-cream))]/80 focus-visible:outline-none"
							rows={4}
						/>
					</updateContentFetcher.Form>
				</div>
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
		</div>
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
