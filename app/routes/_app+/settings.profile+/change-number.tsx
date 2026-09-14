import { parseWithZod } from '@conform-to/zod/v4'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	redirect,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from 'react-router'
import { z } from 'zod'
import {
	prepareVerification,
	requireRecentVerification,
} from '#app/routes/_app+/_auth+/verify.server.ts'
import { requireUserId } from '#app/utils/auth.server.ts'
import { combinePhoneNumber } from '#app/utils/country-codes.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendText } from '#app/utils/text.server.js'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { ChangeNumberSchema } from './__schemas.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export const newPhoneNumberSessionKey = 'new-phone-number'

/**
 * The phone number is edited inline on the settings page; this route only
 * hosts the action that kicks off verification of the new number.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	await requireRecentVerification(request)
	throw redirect('/settings/profile?edit=phone')
}

export async function action({ request }: ActionFunctionArgs) {
	await requireRecentVerification(request)
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const submission = await parseWithZod(formData, {
		schema: ChangeNumberSchema.transform(({ countryCode, phoneNumber }) =>
			combinePhoneNumber(countryCode ?? '', phoneNumber),
		).superRefine(async (phoneNumber, ctx) => {
			if (!/^\+\d{6,29}$/.test(phoneNumber)) {
				ctx.addIssue({
					path: ['phoneNumber'],
					code: z.ZodIssueCode.custom,
					message: 'Enter a valid phone number, digits only.',
				})
				return
			}
			const existingUser = await prisma.user.findUnique({
				where: { phoneNumber },
				select: { id: true },
			})
			if (existingUser) {
				ctx.addIssue({
					path: ['phoneNumber'],
					code: z.ZodIssueCode.custom,
					message:
						existingUser.id === userId
							? 'That is already your phone number.'
							: 'This phone number is already in use.',
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
	const newPhoneNumber = submission.value
	const { otp, redirectTo, verifyUrl } = await prepareVerification({
		period: 10 * 60,
		request,
		target: userId,
		type: 'change-phone-number',
	})

	const response = await sendText({
		to: newPhoneNumber,
		message: `GratiText Phone Number Change Verification\n\nHere's your verification code: ${otp}\n\nOr click here to verify: ${verifyUrl.toString()}`,
	})

	if (response.status === 'success') {
		const verifySession = await verifySessionStorage.getSession()
		verifySession.set(newPhoneNumberSessionKey, newPhoneNumber)
		return redirect(redirectTo.toString(), {
			headers: {
				'set-cookie': await verifySessionStorage.commitSession(verifySession),
			},
		})
	} else {
		return json(
			{ result: submission.reply({ formErrors: [response.error] }) },
			{ status: 500 },
		)
	}
}
