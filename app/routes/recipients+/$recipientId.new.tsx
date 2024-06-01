import { getFormProps, useForm, getTextareaProps } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	type ActionFunctionArgs,
	json,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { z } from 'zod'
import { ErrorList, TextareaField } from '#app/components/forms.js'
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
		<>
			<Form
				className="flex w-full flex-col items-center gap-4"
				method="POST"
				{...getFormProps(updateContentForm)}
			>
				<TextareaField
					className="w-full flex-1"
					labelProps={{ children: `Message` }}
					textareaProps={{
						...getTextareaProps(updateContentFields.content),
					}}
					errors={updateContentFields.content.errors}
				/>
				<StatusButton
					status={isPending ? 'pending' : 'idle'}
					className="self-end"
					type="submit"
				>
					Save
				</StatusButton>
				<ErrorList
					id={updateContentForm.errorId}
					errors={updateContentForm.errors}
				/>
			</Form>
		</>
	)
}
