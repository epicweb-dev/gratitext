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

type FutureMessage = SerializeFrom<typeof loader>['futureMessages'][number]

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			scheduleCron: true,
			timeZone: true,
			messages: {
				select: { id: true, content: true, sentAt: true, order: true },
				orderBy: { order: 'asc' },
				where: { sentAt: null },
			},
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const { messages, ...recipientProps } = recipient

	return json({
		recipient: recipientProps,
		futureMessages: messages
			.sort((m1, m2) => m1.order - m2.order)
			.map((m, i, arr) => {
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
					id: m.id,
					content: m.content,
					order: m.order,
					earlierOrder,
					laterOrder,
					sendAtDisplay,
				}
			}),
	})
}

const MessageSchema = z.object({
	id: z.string(),
	content: z.string().min(1).max(5000),
})

type MessageActionArgs = {
	request: Request
	userId: string
	recipientId: string
	formData: FormData
}

const sendMessageActionIntent = 'send-message'
const deleteMessageActionIntent = 'delete-message'
const updateMessageActionIntent = 'update-message'

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
		case updateMessageActionIntent: {
			return updateMessageAction({ request, userId, recipientId, formData })
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

	const data = submission.value

	const message = await prisma.message.findFirst({
		where: { id: data.id, recipient: { userId } },
		select: {
			id: true,
			content: true,
			recipient: { select: { id: true } },
		},
	})
	if (!message) {
		return json({
			result: submission.reply({ formErrors: ['Message not found'] }),
		})
	}

	const response = await sendTextToRecipient({
		message: message.content,
		recipientId: message.recipient.id,
	})
	if (response.status === 'success') {
		await prisma.message.update({
			where: { id: data.id, recipient: { userId } },
			select: { id: true },
			data: { sentAt: new Date() },
		})
	} else {
		return json({
			result: submission.reply({ formErrors: [response.error] }),
		})
	}

	await prisma.message.update({
		where: { id: data.id },
		data: { sentAt: new Date() },
	})

	return json({ result: submission.reply() }, { status: 200 })
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

const UpdateMessageSchema = z.object({
	id: z.string(),
	order: z.number().min(0),
})
async function updateMessageAction({ formData }: MessageActionArgs) {
	const submission = parseWithZod(formData, {
		schema: UpdateMessageSchema,
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

	// TODO: add optimistic UI

	return (
		<ul className="flex flex-col gap-12">
			{data.futureMessages.length ? (
				data.futureMessages.map(m => (
					<li key={m.id} className="flex justify-start gap-2 align-top">
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
	const updateContentFetcher = useFetcher<typeof updateMessageAction>()
	const [updateContentForm, updateContentFields] = useForm({
		id: `message-form-${message.id}`,
		constraint: getZodConstraint(MessageSchema),
		defaultValue: message,
		lastResult: updateContentFetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: MessageSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<>
			<div className="flex w-full items-center gap-4">
				<div>
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
						labelProps={{ children: `Message (${message.sendAtDisplay})` }}
						textareaProps={{
							...getTextareaProps(updateContentFields.content),
						}}
						errors={updateContentFields.content.errors}
					/>
				</updateContentFetcher.Form>
				<div className="flex flex-col gap-2">
					<StatusButton
						form={updateContentForm.id}
						status={updateContentFetcher.state !== 'idle' ? 'pending' : 'idle'}
						className="w-full"
						type="submit"
						name="intent"
						value={updateMessageActionIntent}
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
	message: FutureMessage
	direction: 'later' | 'earlier'
}) {
	const fetcher = useFetcher<typeof updateMessageAction>()
	const [form, fields] = useForm({
		id: `message-earlier-form-${message.id}`,
		constraint: getZodConstraint(UpdateMessageSchema),
		defaultValue: message,
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			const result = parseWithZod(formData, { schema: UpdateMessageSchema })
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
			<StatusButton
				variant="ghost"
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				type="submit"
				name="intent"
				value={updateMessageActionIntent}
			>
				{/* TODO: the tooltip doesn't seem to be working... */}
				{direction === 'later' ? (
					<SimpleTooltip content="Move later">
						<Icon size="lg" name="chevron-down" />
					</SimpleTooltip>
				) : (
					<SimpleTooltip content="Move earlier">
						<Icon size="lg" name="chevron-up" />
					</SimpleTooltip>
				)}
			</StatusButton>
			<ErrorList id={fields.order.errorId} errors={fields.order.errors} />
		</fetcher.Form>
	) : null
}

function SendNowForm({ message }: { message: FutureMessage }) {
	const fetcher = useFetcher<typeof sendMessageAction>()
	const [form] = useForm({
		id: `send-now-form-${message.id}`,
		constraint: getZodConstraint(SendMessageSchema),
		defaultValue: message,
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

function DeleteForm({ message }: { message: FutureMessage }) {
	const fetcher = useFetcher<typeof deleteMessageAction>()
	const [form] = useForm({
		id: `delete-form-${message.id}`,
		constraint: getZodConstraint(DeleteMessageSchema),
		defaultValue: message,
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
