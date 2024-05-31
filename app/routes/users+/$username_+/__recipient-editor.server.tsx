import { parseWithZod } from '@conform-to/zod'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { RecipientEditorSchema } from './__recipient-editor.tsx'

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await request.formData()

	const submission = await parseWithZod(formData, {
		schema: RecipientEditorSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const recipient = await prisma.recipient.findUnique({
				select: { id: true },
				where: { id: data.id, userId },
			})
			if (!recipient) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Recipient not found',
				})
			}
		}),
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { id: recipientId, name, phoneNumber, scheduleCron } = submission.value

	const updatedRecipient = await prisma.recipient.upsert({
		select: { id: true, user: { select: { username: true } } },
		where: { id: recipientId ?? '__new_recipient__' },
		create: {
			userId,
			name,
			phoneNumber,
			verified: false,
			scheduleCron,
		},
		update: {
			name,
			phoneNumber,
			scheduleCron,
		},
	})

	return redirect(
		`/users/${updatedRecipient.user.username}/recipients/${updatedRecipient.id}`,
	)
}
