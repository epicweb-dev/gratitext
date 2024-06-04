import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { prisma } from '#app/utils/db.server.js'
import { getCustomerProducts } from '#app/utils/stripe.server.js'
import { type BreadcrumbHandle } from './_layout.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="banknotes-outline">Subscription</Icon>,
	getSitemapEntries: () => null,
}

export async function loader({ request }: { request: Request }) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { stripeId: true },
	})
	const products = user.stripeId ? await getCustomerProducts(user.stripeId) : []
	return json({
		products,
		basicPaymentUrl: process.env.STRIPE_BASIC_PAYMENT_LINK,
		premiumPaymentUrl: process.env.STRIPE_PREMIUM_PAYMENT_LINK,
	})
}

export default function Subscribe() {
	const data = useLoaderData<typeof loader>()
	const isBasic = data.products.includes('basic')
	const isPremium = data.products.includes('premium')
	return (
		<div className="container">
			<p>You are currently subscribed to {data.products.join(', ')}</p>
			{isBasic || isPremium ? null : (
				<Button asChild>
					<a href={data.basicPaymentUrl}>Subscribe to Basic</a>
				</Button>
			)}
			{isPremium ? null : (
				<Button asChild>
					<a href={data.premiumPaymentUrl}>Subscribe to Premium</a>
				</Button>
			)}
		</div>
	)
}

export function ErrorBoundary() {
	// POLISH: make the error message more helpful
	return <GeneralErrorBoundary />
}
