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
import cronParser from 'cron-parser'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList, TextareaField } from '#app/components/forms.js'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			userId: true,
			scheduleCron: true,
			messages: {
				select: { id: true, content: true, sentAt: true, order: true },
				orderBy: { order: 'asc' },
				where: { sentAt: undefined },
			},
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const { messages, ...recipientProps } = recipient

	const interval = cronParser.parseExpression(recipientProps.scheduleCron)

	return json({
		recipient: recipientProps,
		pastMessages: messages
			.filter(m => m.sentAt)
			.sort((m1, m2) => m1.sentAt!.getTime() - m2.sentAt!.getTime())
			.map(m => ({
				id: m.id,
				sentAtDisplay: m.sentAt!.toLocaleDateString('en-US', {
					weekday: 'short',
					year: 'numeric',
					month: 'short',
					day: 'numeric',
					hour: 'numeric',
					minute: 'numeric',
				}),
				content: m.content,
			})),
		futureMessages: messages
			.filter(m => !m.sentAt)
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
				const sendAtDisplay = interval
					.next()
					.toDate()
					.toLocaleDateString('en-US', {
						weekday: 'short',
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: 'numeric',
						minute: 'numeric',
					})
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
	order: z.number().min(0).optional(),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = await parseWithZod(formData, {
		async: true,
		schema: MessageSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value

	const updatedMessage = await prisma.message.update({
		where: { id: data.id, recipient: { userId } },
		select: { id: true },
		data: { content: data.content, order: data.order ? data.order : undefined },
	})

	return json(
		{
			result: submission.reply({
				formErrors: updatedMessage ? [] : ['Message not found'],
			}),
		},
		{ status: updatedMessage ? 200 : 400 },
	)
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">
				{data.recipient.name}
				<small className="block text-sm text-secondary-foreground">
					{data.recipient.phoneNumber}
				</small>
			</h2>
			<div className="overflow-y-auto pb-24">
				<h3>Upcoming Messages</h3>
				<ul className="flex flex-col gap-2">
					{data.futureMessages.map(m => (
						<li key={m.id} className="flex justify-start gap-2 align-top">
							<MessageForm message={m} />
						</li>
					))}
				</ul>
				<ul className="flex flex-col gap-2">
					{data.pastMessages.map(m => (
						<li
							key={m.id}
							className="flex flex-col justify-start gap-2 align-top lg:flex-row"
						>
							<span className="text-muted-secondary-foreground min-w-36">
								{m.sentAtDisplay}
							</span>
							<span>{m.content}</span>
						</li>
					))}
				</ul>
			</div>
			<div className={floatingToolbarClassName}>
				<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
					<Button
						asChild
						className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
					>
						<Link to="edit">
							<Icon name="pencil-1" className="scale-125 max-md:scale-150">
								<span className="max-md:hidden">Edit</span>
							</Icon>
						</Link>
					</Button>
				</div>
			</div>
		</div>
	)
}

function MessageForm({
	message,
}: {
	message: SerializeFrom<typeof loader>['futureMessages'][number]
}) {
	const fetcher = useFetcher<typeof action>()
	const [form, fields] = useForm({
		id: `message-form-${message.id}`,
		constraint: getZodConstraint(MessageSchema),
		defaultValue: message,
		lastResult: fetcher.data?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: MessageSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<fetcher.Form method="POST" {...getFormProps(form)} className="w-full">
			{/*
				This hidden submit button is here to ensure that when the user hits
				"enter" on an input field, the primary form function is submitted
				rather than the first button in the form (which is delete/add image).
			*/}
			<button type="submit" className="hidden" />
			<input type="hidden" name="id" value={message.id} />
			<div className="flex w-full items-center gap-4">
				<div>
					{message.earlierOrder ? (
						<StatusButton
							variant="ghost"
							status={
								fetcher.state !== 'idle' &&
								fetcher.formData?.get('order') ===
									message.earlierOrder.toString()
									? 'pending'
									: 'idle'
							}
							type="submit"
							name="order"
							value={message.earlierOrder.toString()}
						>
							<Icon size="lg" name="chevron-up" title="Move earlier" />
						</StatusButton>
					) : null}
					{message.laterOrder ? (
						<StatusButton
							variant="ghost"
							status={
								fetcher.state !== 'idle' &&
								fetcher.formData?.get('order') === message.laterOrder.toString()
									? 'pending'
									: 'idle'
							}
							type="submit"
							name="order"
							value={message.laterOrder.toString()}
						>
							<Icon size="lg" name="chevron-down" title="Move later" />
						</StatusButton>
					) : null}
					<ErrorList id={fields.order.errorId} errors={fields.order.errors} />
				</div>
				<TextareaField
					className="flex-1"
					labelProps={{ children: `Message (${message.sendAtDisplay})` }}
					textareaProps={{
						...getTextareaProps(fields.content),
					}}
					errors={fields.content.errors}
				/>
				<StatusButton
					status={
						fetcher.state !== 'idle' &&
						fetcher.formData?.get('content') !== message.content
							? 'pending'
							: 'idle'
					}
					type="submit"
				>
					Save
				</StatusButton>
			</div>
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
