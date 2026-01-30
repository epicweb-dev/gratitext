import { invariant } from '@epic-web/invariant'
import { json } from 'react-router'
import {
	requireRecentVerification,
	type VerifyFunctionArgs,
} from '#app/routes/_app+/_auth+/verify.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendText } from '#app/utils/text.server.js'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { newPhoneNumberSessionKey } from './change-number'

export async function handleVerification({
	request,
	submission,
}: VerifyFunctionArgs) {
	await requireRecentVerification(request)
	invariant(
		submission.status === 'success',
		'Submission should be successful by now',
	)

	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const newPhoneNumber = verifySession.get(newPhoneNumberSessionKey)
	if (!newPhoneNumber) {
		return json(
			{
				result: submission.reply({
					formErrors: [
						'You must submit the code on the same device that requested the phone number change.',
					],
				}),
			},
			{ status: 400 },
		)
	}
	const preUpdateUser = await prisma.user.findFirstOrThrow({
		select: { phoneNumber: true },
		where: { id: submission.value.target },
	})
	const user = await prisma.user.update({
		where: { id: submission.value.target },
		select: { id: true, phoneNumber: true, username: true },
		data: { phoneNumber: newPhoneNumber },
	})

	void sendText({
		to: preUpdateUser.phoneNumber,
		message: `GratiText phone number changed\n\nIf you changed your phone number, then you can safely ignore this. But if you did not change your phone number address, then please contact support immediately.\n\nYour Account ID: ${user.id}`,
	})

	return redirectWithToast(
		'/settings/profile',
		{
			title: 'Phone Number Changed',
			type: 'success',
			description: `Your phone number has been changed to ${user.phoneNumber}`,
		},
		{
			headers: {
				'set-cookie': await verifySessionStorage.destroySession(verifySession),
			},
		},
	)
}
