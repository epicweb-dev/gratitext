import { invariant } from '@epic-web/invariant'
import { json, redirect } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { resetPasswordUsernameSessionKey } from './reset-password.tsx'
import { type VerifyFunctionArgs } from './verify.server.ts'

export async function handleVerification({ submission }: VerifyFunctionArgs) {
	invariant(
		submission.status === 'success',
		'Submission should be successful by now',
	)
	const target = submission.value.target
	const user = await prisma.user.findFirst({
		where: { OR: [{ phoneNumber: target }, { username: target }] },
		select: { phoneNumber: true, username: true },
	})
	// we don't want to say the user is not found if the phoneNumber is not found
	// because that would allow an attacker to check if an phoneNumber is registered
	if (!user) {
		return json(
			{ result: submission.reply({ fieldErrors: { code: ['Invalid code'] } }) },
			{ status: 400 },
		)
	}

	const verifySession = await verifySessionStorage.getSession()
	verifySession.set(resetPasswordUsernameSessionKey, user.username)
	return redirect('/reset-password', {
		headers: {
			'set-cookie': await verifySessionStorage.commitSession(verifySession),
		},
	})
}
