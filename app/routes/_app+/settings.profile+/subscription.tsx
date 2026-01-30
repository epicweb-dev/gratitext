import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { getHints } from '#app/utils/client-hints.js'
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
	const productsData = user.stripeId
		? await getCustomerProducts(user.stripeId)
		: { products: [], cancelAt: null }
	const { timeZone } = getHints(request)
	return json({
		products: productsData.products,
		cancelAtDisplay: productsData.cancelAt
			? new Date(productsData.cancelAt).toLocaleDateString('en-US', {
					timeZone: timeZone ?? 'Etc/UTC',
					dateStyle: 'full',
				})
			: null,
		basicPaymentUrl: process.env.STRIPE_BASIC_PAYMENT_LINK,
		premiumPaymentUrl: process.env.STRIPE_PREMIUM_PAYMENT_LINK,
	})
}

export default function Subscribe() {
	const data = useLoaderData<typeof loader>()
	const { products, cancelAtDisplay } = data
	const isBasic = products.includes('basic')
	const isPremium = products.includes('premium')
	const isSubscribed = products.length > 0
	return (
		<div className="container flex flex-col items-center justify-center pb-20 pt-16">
			<div className="text-center">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
					GratiText
				</p>
				<h1 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
					Select Your Plan
				</h1>
				<p className="mt-3 text-body-sm text-muted-foreground">
					Choose a plan that matches how often you want to send messages.
				</p>
			</div>
			<div className="mt-10 grid w-full max-w-4xl gap-6 md:grid-cols-2">
				<div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-xl font-bold text-foreground">Basic</h3>
							<p className="text-body-xs text-muted-foreground">
								1 message per day
							</p>
						</div>
						<p className="text-2xl font-bold text-[hsl(var(--palette-cloud))]">
							$4
						</p>
					</div>
				<div className="mt-6">
					{isBasic ? (
						<Button variant="secondary" disabled>
							Select
						</Button>
					) : (
						<Button asChild variant="secondary">
							<a href={data.basicPaymentUrl}>Select</a>
						</Button>
					)}
				</div>
				</div>
				<div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-xl font-bold text-foreground">Premium</h3>
							<p className="text-body-xs text-muted-foreground">
								10 messages per day
							</p>
						</div>
						<p className="text-2xl font-bold text-[hsl(var(--palette-chestnut))]">
							$14
						</p>
					</div>
				<div className="mt-6">
					{isPremium ? (
						<Button disabled>
							Select
						</Button>
					) : (
						<Button asChild>
							<a href={data.premiumPaymentUrl}>Select</a>
						</Button>
					)}
				</div>
				</div>
			</div>
			{cancelAtDisplay ? (
				<p className="mt-6 text-sm text-foreground-destructive">
					Your subscription will be cancelled at{' '}
					<strong>{cancelAtDisplay}</strong>.
				</p>
			) : null}
			{isSubscribed ? (
				<Link className="mt-4 text-sm font-semibold underline" to="/manage-subscription">
					Manage your subscription
				</Link>
			) : (
				<Link className="mt-4 text-sm font-semibold underline" to="/recipients">
					Skip for now
				</Link>
			)}
		</div>
	)
}

export function ErrorBoundary() {
	// POLISH: make the error message more helpful
	return <GeneralErrorBoundary />
}
