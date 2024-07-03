import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.js'
import { prisma } from '#app/utils/db.server.js'
import { getDomainUrl } from '#app/utils/misc.js'
import { createCustomerPortalSession } from '#app/utils/stripe.server.js'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { stripeId: true },
	})
	if (!user.stripeId) {
		return redirect('/settings/profile/subscription')
	}
	const session = await createCustomerPortalSession(user.stripeId, {
		returnUrl: getDomainUrl(request) + '/settings/profile/subscription',
	})
	return redirect(session.url)
}
