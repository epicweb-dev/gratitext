import { parseWithZod } from '@conform-to/zod/v4'
import { invariant, invariantResponse } from '@epic-web/invariant'
import { data as json, redirect, type ActionFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	NEXT_SCHEDULE_SENTINEL_DATE,
	PREV_SCHEDULE_SENTINEL_DATE,
} from '#app/utils/schedule-constants.server.ts'
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
	recipient: {
		id: string
		name: string
		phoneNumber: string
		verified: boolean
		disabled: boolean
	}
	formData: FormData
	request: Request
	userId: string
}

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const { recipientId } = params

	const recipient = recipientId
		? await prisma.recipient.findUnique({
				where: { id: recipientId },
				select: {
					id: true,
					userId: true,
					name: true,
					phoneNumber: true,
					verified: true,
					disabled: true,
				},
			})
		: null
	const ownedRecipient =
		recipient && recipient.userId === userId
			? {
					id: recipient.id,
					name: recipient.name,
					phoneNumber: recipient.phoneNumber,
					verified: recipient.verified,
					disabled: recipient.disabled,
				}
			: null

	const formData = await request.formData()

	switch (formData.get('intent')) {
		case deleteRecipientActionIntent: {
			invariantResponse(ownedRecipient, 'Recipient not found', { status: 404 })
			return deleteRecipientAction({
				formData,
				userId,
				request,
				recipient: ownedRecipient,
			})
		}
		case upsertRecipientActionIntent: {
			return usertRecipientAction({
				formData,
				userId,
				request,
				recipient: ownedRecipient,
			})
		}
		case sendVerificationActionIntent: {
			invariantResponse(ownedRecipient, 'Recipient not found', { status: 404 })
			return sendVerificationAction({
				formData,
				userId,
				request,
				recipient: ownedRecipient,
			})
		}
		default: {
			throw new Response('Invalid intent', { status: 400 })
		}
	}
}

export async function usertRecipientAction({
	formData,
	userId,
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

	const {
		id: recipientId,
		name,
		phoneNumber,
		scheduleCron,
		timeZone,
		disabled,
	} = submission.value

	let scheduleData: { prevScheduledAt: Date; nextScheduledAt: Date }
	try {
		scheduleData = getScheduleWindow(scheduleCron, timeZone)
	} catch {
		// Use sentinel dates when schedule can't be computed
		scheduleData = {
			prevScheduledAt: PREV_SCHEDULE_SENTINEL_DATE,
			nextScheduledAt: NEXT_SCHEDULE_SENTINEL_DATE,
		}
	}

	const scheduleFields = {
		prevScheduledAt: scheduleData.prevScheduledAt,
		nextScheduledAt: scheduleData.nextScheduledAt,
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true, phoneNumber: true },
	})
	invariantResponse(user, 'User not found')

	if (recipientId) {
		invariantResponse(recipient, 'Recipient not found')
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
				timeZone,
				disabled: disabled ?? false,
				...scheduleFields,
			},
		})
		return redirect(`/recipients/${updatedRecipient.id}`)
	} else {
		const newRecipient = await prisma.recipient.create({
			select: { id: true },
			data: {
				name,
				phoneNumber,
				scheduleCron,
				userId,
				timeZone,
				verified: false,
				disabled: disabled ?? false,
				...scheduleFields,
			},
		})

		return redirectWithToast(`/recipients/${newRecipient.id}/edit`, {
			type: 'success',
			title: 'Recipient created',
			description:
				'Your recipient has been created. You must verify them before sending messages.',
		})
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

	const recipient = await prisma.recipient.findUnique({
		select: { id: true, userId: true },
		where: { id: recipientId },
	})

	if (!recipient || recipient.userId !== userId) {
		throw new Response('Not found', { status: 404 })
	}

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
			message: `Hello ${recipient.name},\nYou have been added as a recipient to GratiText messages fom ${user.name ?? user.username} (${user.phoneNumber}). You can expect regular, thoughtful texts from them. First, we need to verify your number and get your consent. Please provide ${user.name ?? user.username} (${user.phoneNumber}) with the following code to provide your consent:\n\n${otp}\n\nLearn more at https://www.GratiText.app.\n\nTo opt-out of all text messages from GratiText, reply STOP to this message.`,
		})

		return redirect(redirectTo.toString())
	}
}
