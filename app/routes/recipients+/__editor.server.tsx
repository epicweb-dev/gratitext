import { parseWithZod } from '@conform-to/zod'
import { invariant, invariantResponse } from '@epic-web/invariant'
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendText } from '#app/utils/text.server.js'
import { redirectWithToast } from '#app/utils/toast.server.js'
import {
	getRedirectToUrl,
	prepareVerification,
	type VerifyFunctionArgs,
} from '../_auth+/verify.server.ts'
import { type VerificationTypes } from '../_auth+/verify.tsx'
import {
	DeleteRecipientSchema,
	RecipientEditorSchema,
	deleteRecipientActionIntent,
	sendVerificationActionIntent,
	upsertRecipientActionIntent,
} from './__editor.tsx'

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

type RecipientActionArgs = {
	recipient: { id: string; phoneNumber: string; verified: boolean }
	formData: FormData
	request: Request
	userId: string
}

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const { recipientId } = params

	const recipient = recipientId
		? await prisma.recipient.findUnique({
				where: { id: recipientId, userId },
				select: { id: true, phoneNumber: true, verified: true },
			})
		: null

	const formData = await request.formData()

	switch (formData.get('intent')) {
		case deleteRecipientActionIntent: {
			invariantResponse(recipient, 'Recipient not found', { status: 404 })
			return deleteRecipientAction({ formData, userId, request, recipient })
		}
		case upsertRecipientActionIntent: {
			return usertRecipientAction({ formData, userId, request, recipient })
		}
		case sendVerificationActionIntent: {
			invariantResponse(recipient, 'Recipient not found', { status: 404 })
			return sendVerificationAction({ formData, userId, request, recipient })
		}
		default: {
			throw new Response('Invalid intent', { status: 400 })
		}
	}
}

export async function usertRecipientAction({
	formData,
	userId,
	request,
	recipient,
}: Pick<RecipientActionArgs, 'formData' | 'request' | 'userId'> & {
	recipient: RecipientActionArgs['recipient'] | null
}) {
	const submission = await parseWithZod(formData, {
		schema: RecipientEditorSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { id: recipientId, name, phoneNumber, scheduleCron } = submission.value

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true, phoneNumber: true },
	})
	invariantResponse(user, 'User not found')

	if (recipientId) {
		invariantResponse(recipient, 'Recipient not found')
		const verified = phoneNumber === recipient?.phoneNumber
		const updatedRecipient = await prisma.recipient.update({
			select: { id: true },
			where: { id: recipientId },
			data: {
				name,
				// only change the verified state to unverified if the phone number has changed
				// if it's unchanged, then don't change the verified state because you could
				// accidentally change it from false to true.
				verified: phoneNumber !== recipient?.phoneNumber ? false : undefined,
				phoneNumber,
				scheduleCron,
			},
		})
		if (verified) {
			return redirect(`/recipients/${updatedRecipient.id}`)
		} else {
			return sendVerificationAction({ formData, userId, request, recipient })
		}
	} else {
		recipient = await prisma.recipient.create({
			select: { id: true, phoneNumber: true, verified: true },
			data: {
				name,
				phoneNumber,
				scheduleCron,
				userId,
				verified: false,
			},
		})

		return sendVerificationAction({ formData, userId, request, recipient })
	}
}

export async function deleteRecipientAction({
	formData,
	userId,
}: RecipientActionArgs) {
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

export async function sendVerificationAction({
	recipient,
	request,
	userId,
}: RecipientActionArgs) {
	const type: VerificationTypes = 'validate-recipient'
	const target = recipient.phoneNumber
	const existingVerification = await prisma.verification.findUnique({
		where: { target_type: { type, target } },
		select: { id: true, createdAt: true },
	})
	if (
		existingVerification?.createdAt &&
		Date.now() - existingVerification.createdAt.getTime() < 1000 * 60
	) {
		const reqUrl = new URL(request.url)
		const redirectTo = getRedirectToUrl({
			request,
			type,
			target,
			redirectTo: reqUrl.pathname + reqUrl.search,
		}).toString()

		return redirectWithToast(redirectTo, {
			type: 'message',
			description:
				'A verification code was sent recently. Please enter that one here, or wait a minute before requesting a new one.',
		})
	} else {
		const { redirectTo, otp } = await prepareVerification({
			period: 10 * 60,
			request,
			// leaving off 0 and only using numbers to reduce confusion
			charSet: '123456789',
			type: 'validate-recipient',
			target: recipient.phoneNumber,
		})

		const user = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { name: true, username: true, phoneNumber: true },
		})

		await sendText({
			to: recipient.phoneNumber,
			// TODO: support receiving messages for opt out.
			message: `Hello,\nYou have been added as a recipient to GratiText messages fom ${user.name ?? user.username} (${user.phoneNumber}). You can expect regular, thoughtful texts from them. However, they need your consent first. Please provide them with the following code to provide your consent: ${otp}.\nLearn more at https://www.GratiText.app.\n\nTo opt-out of all text messages from GratiText, reply STOP to this message.`,
		})

		return redirect(redirectTo.toString())
	}
}
