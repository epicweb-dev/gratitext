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
import { ErrorList, TextareaField } from '#app/components/forms.js'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.js'
import { formatSendTime, getSendTime } from '#app/utils/cron.server.js'
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
		futureMessages: messages
			.sort((m1, m2) => m1.order - m2.order)
			.map((m, i, arr) => {
				const base = {
					id: m.id,
					content: m.content,
					order: m.order,
					earlierOrder: null,
					laterOrder: null,
					sendAtDisplay: null,
				}
				if (optOut) return base

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

	return (
		<ul className="flex flex-col gap-6 sm:gap-12">
			{data.futureMessages.length ? (
				data.futureMessages.map((m) => (
					<li
						key={m.id}
						className="flex flex-col gap-4 sm:flex-row sm:justify-start sm:gap-2"
					>
						<MessageForms message={m} />
					</li>
				))
			) : (
				<Link to="new" className="underline">
					Create a new message
				</Link>
			)}
		</ul>
	)
}

function MessageForms({ message }: { message: FutureMessage }) {
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

	return (
		<>
			<div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex justify-center gap-2 sm:flex-col">
					<UpdateOrderForm message={message} direction="earlier" />
					<UpdateOrderForm message={message} direction="later" />
				</div>
				<updateContentFetcher.Form
					method="POST"
					{...getFormProps(updateContentForm)}
					className="flex-1"
				>
					<input type="hidden" name="id" value={message.id} />
					<TextareaField
						labelProps={{
							children: message.sendAtDisplay
								? `Message (${message.sendAtDisplay})`
								: 'Message',
						}}
						textareaProps={{
							...getTextareaProps(updateContentFields.content),
						}}
						errors={updateContentFields.content.errors}
					/>
				</updateContentFetcher.Form>
				<div className="flex flex-row gap-2 sm:flex-col">
					<StatusButton
						form={updateContentForm.id}
						status={updateContentFetcher.state !== 'idle' ? 'pending' : 'idle'}
						className="flex-1 sm:w-full"
						type="submit"
						name="intent"
						value={updateMessageContentActionIntent}
					>
						Save
					</StatusButton>
					<ErrorList
						id={updateContentForm.errorId}
						errors={updateContentForm.errors}
					/>
					<SendNowForm message={message} />
					<DeleteForm message={message} />
				</div>
			</div>
		</>
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
					variant="ghost"
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
					type="submit"
					name="intent"
					value={updateMessageOrderActionIntent}
				>
					{direction === 'later' ? (
						<Icon size="lg" name="chevron-down" />
					) : (
						<Icon size="lg" name="chevron-up" />
					)}
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
				variant="secondary"
				className="w-full"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				type="submit"
				name="intent"
				value={sendMessageActionIntent}
			>
				Send Now
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

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<input type="hidden" name="id" value={message.id} />
			<StatusButton
				variant={dc.doubleCheck ? 'destructive' : 'ghost'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				className="w-full data-[safe-delay=true]:opacity-50"
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: deleteMessageActionIntent,
				})}
			>
				{dc.doubleCheck ? 'Confirm' : 'Delete'}
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
