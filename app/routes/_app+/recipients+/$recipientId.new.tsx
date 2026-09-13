import { getFormProps, useForm, getTextareaProps } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import {
	type ActionFunctionArgs,
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	Form,
	useActionData,
} from 'react-router'
import { z } from 'zod'
import { ErrorList, TextareaField } from '#app/components/forms.js'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { prisma } from '#app/utils/db.server.js'
import { useIsPending } from '#app/utils/misc.js'
import { redirectWithToast } from '#app/utils/toast.server.js'

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireUserId(request)
	const { recipientId } = params
	invariantResponse(recipientId, 'Invalid recipient', { status: 400 })
	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId },
		select: { name: true, phoneNumber: true },
	})
	return json({ recipient })
}

const NewMessageSchema = z.object({
	content: z.string().min(1).max(5000),
})
export async function action({ request, params }: ActionFunctionArgs) {
	await requireUserId(request)
	const { recipientId } = params
	invariantResponse(recipientId, 'Invalid recipient', { status: 400 })
	const formData = await request.formData()
	const submission = parseWithZod(formData, {
		schema: NewMessageSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value
	const earliestMessage = await prisma.message.findFirst({
		where: { recipientId, sentAt: null },
		select: { order: true },
		orderBy: { order: 'asc' },
	})

	await prisma.message.create({
		data: {
			content: data.content,
			recipientId,
			order: earliestMessage ? earliestMessage.order / 2 : 10000,
		},
	})

	return redirectWithToast(`/recipients/${recipientId}`, {
		type: 'success',
		title: 'Message created',
		description: 'Your message has been created',
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `New Message | ${data?.recipient?.name ?? data?.recipient?.phoneNumber} | GratiText`,
		},
	]
}

export default function RecipientIdNew() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [updateContentForm, updateContentFields] = useForm({
		id: `new-message-form`,
		constraint: getZodConstraint(NewMessageSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: NewMessageSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="text-foreground text-2xl font-bold">New message</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					Write it in your own words. It will be sent at the next scheduled
					time.
				</p>
			</div>
			<Form
				className="flex w-full flex-col gap-4"
				method="POST"
				{...getFormProps(updateContentForm)}
			>
				<TextareaField
					className="w-full"
					labelProps={{ children: `Message` }}
					textareaProps={{
						...getTextareaProps(updateContentFields.content),
						autoFocus: true,
						placeholder: 'Thank you for always…',
						rows: 5,
					}}
					errors={updateContentFields.content.errors}
				/>
				<ErrorList
					id={updateContentForm.errorId}
					errors={updateContentForm.errors}
				/>
				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<ButtonLink variant="secondary" to="..">
						Cancel
					</ButtonLink>
					<StatusButton
						status={isPending ? 'pending' : 'idle'}
						type="submit"
						variant="brand"
					>
						<Icon name="check">Save message</Icon>
					</StatusButton>
				</div>
			</Form>
		</div>
	)
}
