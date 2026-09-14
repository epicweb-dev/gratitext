import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import {
	data as json,
	type LoaderFunctionArgs,
	Outlet,
	useLoaderData,
} from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { twoFAVerificationType } from './two-factor.tsx'

/** Settings sit on the beige tint on phones and plain white on desktop. */
export const handle: SEOHandle & { pageTint: 'hero' } = {
	getSitemapEntries: () => null,
	pageTint: 'hero',
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			username: true,
			phoneNumber: true,
			_count: {
				select: {
					sessions: { where: { expirationDate: { gt: new Date() } } },
				},
			},
		},
	})
	invariantResponse(user, 'User not found', { status: 404 })

	const twoFactorVerification = await prisma.verification.findUnique({
		select: { id: true },
		where: { target_type: { type: twoFAVerificationType, target: userId } },
	})

	return json({
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
			phoneNumber: user.phoneNumber,
			otherSessionsCount: Math.max(user._count.sessions - 1, 0),
		},
		isTwoFactorEnabled: Boolean(twoFactorVerification),
	})
}

export type SettingsOutletContext = Awaited<ReturnType<typeof loader>>['data']

export default function SettingsLayout() {
	const data = useLoaderData<typeof loader>()
	return (
		<main className="flex flex-1 flex-col">
			<Outlet context={data satisfies SettingsOutletContext} />
		</main>
	)
}
