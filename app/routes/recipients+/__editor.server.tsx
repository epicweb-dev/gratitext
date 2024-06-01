import { parseWithZod } from '@conform-to/zod'
import { invariant, invariantResponse } from '@epic-web/invariant'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendText } from '#app/utils/text.server.js'
import { redirectWithToast } from '#app/utils/toast.server.js'
import {
	type VerifyFunctionArgs,
	prepareVerification,
} from '../_auth+/verify.server.ts'
import { DeleteRecipientSchema, RecipientEditorSchema } from './__editor.tsx'

export async function handleVerification({ submission }: VerifyFunctionArgs) {
	invariant(
		submission.status === 'success',
		'Submission should be successful by now',
	)
	const target = submission.value.target
	const recipient = await prisma.recipient.findFirst({
		where: { phoneNumber: target },
		select: { phoneNumber: true, id: true, name: true },
	})

	if (!recipient) {
		return json(
			{ result: submission.reply({ fieldErrors: { code: ['Invalid code'] } }) },
			{ status: 400 },
		)
	}

	await prisma.recipient.update({
		where: { id: recipient.id },
		data: { verified: true },
	})

	return redirectWithToast(`/recipients/${recipient.id}`, {
		type: 'success',
		title: 'Recipient verified',
		description: `${recipient.phoneNumber} has been verified for ${recipient.name}`,
	})
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true, phoneNumber: true },
	})
	invariantResponse(user, 'User not found')

	const formData = await request.formData()

	if (formData.get('intent') === 'delete-recipient') {
		return await deleteRecipient({ formData, userId })
	}

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

	if (recipientId) {
		const updatedRecipient = await prisma.recipient.update({
			select: { id: true },
			where: { id: recipientId },
			data: {
				name,
				phoneNumber,
				scheduleCron,
			},
		})

		return redirect(`/recipients/${updatedRecipient.id}`)
	} else {
		await prisma.recipient.create({
			select: { id: true },
			data: {
				name,
				phoneNumber,
				scheduleCron,
				userId,
				verified: false,
			},
		})

		const { redirectTo, otp } = await prepareVerification({
			period: 10 * 60,
			request,
			type: 'validate-recipient',
			target: phoneNumber,
		})

		await sendText({
			to: phoneNumber,
			// TODO: support receiving messages for opt out.
			message: `Hello,\nYou have been added as a recipient to GratiText messages fom ${user.name ?? user.username} (${user.phoneNumber}). You can expect regular, thoughtful texts from them. However, they need your consent first. Please provide them with the following code to provide your consent: ${otp}.\nLearn more at https://www.GratiText.app.\n\nTo opt-out of all text messages from GratiText, reply STOP to this message.`,
		})

		return redirect(redirectTo.toString())
	}
}

async function deleteRecipient({
	formData,
	userId,
}: {
	formData: FormData
	userId: string
}) {
	const submission = parseWithZod(formData, {
		schema: DeleteRecipientSchema,
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { recipientId } = submission.value

	const recipient = await prisma.recipient.findFirst({
		select: { id: true, userId: true, user: { select: { username: true } } },
		where: { id: recipientId, userId },
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	await prisma.recipient.delete({ where: { id: recipient.id } })

	return redirectWithToast(`/recipients`, {
		type: 'success',
		title: 'Success',
		description: 'Your recipient has been deleted.',
	})
}
