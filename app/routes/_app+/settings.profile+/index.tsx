import { parseWithZod } from '@conform-to/zod/v4'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
} from 'react-router'
import { requireRecentVerification } from '#app/routes/_app+/_auth+/verify.server.ts'
import { requireUserId, sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { SettingsOverview } from './__overview.tsx'
import {
	deleteDataActionIntent,
	signOutOfSessionsActionIntent,
	UpdateNameSchema,
	updateNameActionIntent,
} from './__schemas.ts'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	// Changing the phone number is sensitive, so opening that editor asks
	// users with 2FA to reverify first (the old dedicated page did the same).
	if (new URL(request.url).searchParams.get('edit') === 'phone') {
		await requireRecentVerification(request)
	}
	return json({})
}

type ProfileActionArgs = {
	request: Request
	userId: string
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	switch (intent) {
		case updateNameActionIntent: {
			return updateNameAction({ request, userId, formData })
		}
		case signOutOfSessionsActionIntent: {
			return signOutOfSessionsAction({ request, userId, formData })
		}
		case deleteDataActionIntent: {
			return deleteDataAction({ request, userId, formData })
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

export default function SettingsIndexRoute() {
	return <SettingsOverview />
}

async function updateNameAction({ userId, formData }: ProfileActionArgs) {
	const submission = parseWithZod(formData, { schema: UpdateNameSchema })
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	await prisma.user.update({
		select: { id: true },
		where: { id: userId },
		data: { name: submission.value.name },
	})

	return redirectWithToast('/settings/profile', {
		type: 'success',
		title: 'Name Updated',
		description: 'Your name has been saved.',
	})
}

async function signOutOfSessionsAction({ request, userId }: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	invariantResponse(
		sessionId,
		'You must be authenticated to sign out of other sessions',
	)
	await prisma.session.deleteMany({
		where: {
			userId,
			id: { not: sessionId },
		},
	})
	return redirectWithToast('/settings/profile', {
		type: 'success',
		title: 'Signed Out',
		description: 'Your other sessions have been signed out.',
	})
}

async function deleteDataAction({ userId }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: userId } })
	return redirectWithToast('/', {
		type: 'success',
		title: 'Data Deleted',
		description: 'All of your data has been deleted',
	})
}
