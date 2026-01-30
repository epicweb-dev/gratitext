import { getFormProps, getTextareaProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type SerializeFrom,
} from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.js'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.js'
import {
	CronParseError,
	formatSendTime,
	getSendTime,
} from '#app/utils/cron.server.js'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck } from '#app/utils/misc.js'
import { sendTextToRecipient } from '#app/utils/text.server.js'
import { createToastHeaders } from '#app/utils/toast.server.js'

type FutureMessage = SerializeFrom<typeof loader>['futureMessages'][number]

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
						sendAtDisplay: error instanceof CronParseError
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
				<div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground-destructive">
					<strong className="font-semibold">Invalid Schedule:</strong>{' '}
					{data.cronError}{' '}
					<Link to="edit" className="underline">
						Update the schedule
					</Link>
				</div>
			) : null}
			<ul className="flex flex-col gap-6">
				{data.futureMessages.length ? (
					data.futureMessages.map((m, index) => (
						<li key={m.id} className="flex flex-col gap-4">
							<MessageForms message={m} index={index} />
						</li>
					))
				) : (
					<Link to="new" className="text-sm font-semibold text-foreground underline">
						Create a new message
					</Link>
				)}
			</ul>
			<div className="flex flex-col gap-2">
				<newMessageFetcher.Form
					method="POST"
					action="new"
					className="rounded-full border border-border bg-card p-2 shadow-sm"
				>
					<label htmlFor="new-message" className="sr-only">
						Add a new message
					</label>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<textarea
							id="new-message"
							name="content"
							placeholder="I am endlessly grateful for your love, your smile, and the joy you bring..."
							className="flex-1 resize-none rounded-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
							rows={2}
							required
						/>
						<StatusButton
							status={isCreating ? 'pending' : 'idle'}
							type="submit"
							className="self-end bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))] sm:self-auto"
						>
							<Icon name="check">Add to Queue</Icon>
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

	return (
		<div className="flex flex-col gap-4 lg:flex-row">
			<div className="flex gap-2 lg:flex-col">
				<UpdateOrderForm message={message} direction="earlier" />
				<UpdateOrderForm message={message} direction="later" />
			</div>
			<div className="flex-1 space-y-3">
				<div className={`rounded-[28px] px-6 py-5 text-[hsl(var(--palette-cream))] shadow-sm ${cardTone}`}>
					<div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--palette-cream))]">
						<div className="flex items-center gap-2">
							<Icon name={isPrimary ? 'check' : 'clock'} size="sm" />
							<span>{headerText}</span>
						</div>
						<div className="flex items-center gap-2">
							<StatusButton
								form={updateContentForm.id}
								status={updateContentFetcher.state !== 'idle' ? 'pending' : 'idle'}
								className="gap-0 text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-cream))/0.15]"
								size="icon"
								variant="ghost"
								type="submit"
								name="intent"
								value={updateMessageContentActionIntent}
							>
								<Icon name="check" size="sm" />
								<span className="sr-only">Save</span>
							</StatusButton>
							<SendNowForm message={message} />
							<DeleteForm message={message} />
						</div>
					</div>
					<updateContentFetcher.Form
						method="POST"
						{...getFormProps(updateContentForm)}
					>
						<input type="hidden" name="id" value={message.id} />
						<label
							htmlFor={updateContentFields.content.id}
							className="sr-only"
						>
							Message content
						</label>
						<textarea
							{...getTextareaProps(updateContentFields.content)}
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
			</div>
		</div>
	)
}

function UpdateOrderForm({
	message,
	direction: direction,
}: {
	message: Pick<FutureMessage, 'id' | 'order' | 'laterOrder' | 'earlierOrder'>
	direction: 'later' | 'earlier'
}) {
	const fetcher = useFetcher<typeof updateMessageOrderAction>()
	const [form, fields] = useForm({
		id: `message-earlier-form-${message.id}`,
		constraint: getZodConstraint(UpdateMessageOrderSchema),
		defaultValue: { id: message.id, order: direction === 'later' ? 0 : 1 },
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			const result = parseWithZod(formData, {
				schema: UpdateMessageOrderSchema,
			})
			if (result.status === 'error') {
				console.error(result.error)
			}
			return result
		},
		shouldRevalidate: 'onBlur',
	})
	const newOrder =
		direction === 'later' ? message.laterOrder : message.earlierOrder
	return newOrder ? (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="id" value={message.id} />
			<input type="hidden" name="order" value={newOrder.toString()} />
			<SimpleTooltip
				delayDuration={1000}
				content={direction === 'later' ? 'Move earlier' : 'Move later'}
			>
				<StatusButton
					variant="secondary"
					size="icon"
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
					className="gap-0 text-muted-foreground hover:text-foreground"
					type="submit"
					name="intent"
					value={updateMessageOrderActionIntent}
				>
					{direction === 'later' ? (
						<Icon size="sm" name="chevron-down" />
					) : (
						<Icon size="sm" name="chevron-up" />
					)}
					<span className="sr-only">
						{direction === 'later' ? 'Move earlier' : 'Move later'}
					</span>
				</StatusButton>
			</SimpleTooltip>
			<ErrorList id={fields.order.errorId} errors={fields.order.errors} />
		</fetcher.Form>
	) : null
}

function SendNowForm({ message }: { message: Pick<FutureMessage, 'id'> }) {
	const fetcher = useFetcher<typeof sendMessageAction>()
	const [form] = useForm({
		id: `send-now-form-${message.id}`,
		constraint: getZodConstraint(SendMessageSchema),
		defaultValue: { id: message.id },
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: SendMessageSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="id" value={message.id} />
			<StatusButton
				variant="ghost"
				size="icon"
				className="gap-0 text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-cream))/0.15]"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				type="submit"
				name="intent"
				value={sendMessageActionIntent}
			>
				<Icon name="send" size="sm" />
				<span className="sr-only">Send now</span>
			</StatusButton>
			<ErrorList id={form.errorId} errors={form.errors} />
		</fetcher.Form>
	)
}

function DeleteForm({ message }: { message: Pick<FutureMessage, 'id'> }) {
	const fetcher = useFetcher<typeof deleteMessageAction>()
	const [form] = useForm({
		id: `delete-form-${message.id}`,
		constraint: getZodConstraint(DeleteMessageSchema),
		defaultValue: { id: message.id },
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: DeleteMessageSchema })
		},
		shouldRevalidate: 'onBlur',
	})
	const dc = useDoubleCheck()
	const deleteClassName = dc.doubleCheck
		? 'gap-0 data-[safe-delay=true]:opacity-50'
		: 'gap-0 text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-cream))/0.15] data-[safe-delay=true]:opacity-50'

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="id" value={message.id} />
			<StatusButton
				variant={dc.doubleCheck ? 'destructive' : 'ghost'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				size="icon"
				className={deleteClassName}
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: deleteMessageActionIntent,
				})}
			>
				<Icon name={dc.doubleCheck ? 'check' : 'trash'} size="sm" />
				<span className="sr-only">
					{dc.doubleCheck ? 'Confirm delete' : 'Delete'}
				</span>
			</StatusButton>
			<ErrorList id={form.errorId} errors={form.errors} />
		</fetcher.Form>
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
