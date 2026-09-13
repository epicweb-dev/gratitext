import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { data as json, Link, useLoaderData } from 'react-router'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { getHints } from '#app/utils/client-hints.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { getCustomerProducts } from '#app/utils/stripe.server.ts'
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

const plans = [
	{
		id: 'basic',
		name: 'Basic',
		price: '$4.99',
		summary: 'One heartfelt note a day.',
		features: [
			'1 message per day',
			'As many recipients as you like',
			'Reminders when a queue runs empty',
		],
		priceClassName: 'text-price-basic',
	},
	{
		id: 'premium',
		name: 'Premium',
		price: '$14.99',
		summary: 'Room for the whole family and your closest friends.',
		features: [
			'Up to 10 messages per day',
			'As many recipients as you like',
			'Reminders when a queue runs empty',
		],
		priceClassName: 'text-price-premium',
		highlighted: true,
	},
] as const

export default function Subscribe() {
	const data = useLoaderData<typeof loader>()
	const { products, cancelAtDisplay } = data
	const isSubscribed = products.length > 0
	const currentPlan = products.includes('premium')
		? 'premium'
		: products.includes('basic')
			? 'basic'
			: null
	const paymentUrls = {
		basic: data.basicPaymentUrl,
		premium: data.premiumPaymentUrl,
	}

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-foreground text-2xl font-bold">
					{isSubscribed ? 'Your subscription' : 'Choose your plan'}
				</h1>
				<p className="text-muted-foreground mt-2 text-sm">
					{isSubscribed
						? 'Billing, invoices, and cancellation are handled securely by Stripe.'
						: 'Pick the plan that matches how often you want to send. Cancel anytime.'}
				</p>
			</div>

			{cancelAtDisplay ? (
				<div className="bg-banner-upgrade text-banner-upgrade-foreground flex items-start gap-3 rounded-2xl px-4 py-3 text-sm">
					<Icon
						name="exclamation-circle-outline"
						size="sm"
						className="mt-0.5 shrink-0"
						aria-hidden="true"
					/>
					<p>
						Your subscription is set to end on{' '}
						<strong>{cancelAtDisplay}</strong>. Scheduled messages will stop
						sending after that date.
					</p>
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2">
				{plans.map((plan) => {
					const isCurrent = currentPlan === plan.id
					const highlighted = 'highlighted' in plan && plan.highlighted
					return (
						<div
							key={plan.id}
							className={cn(
								'border-border bg-card relative flex flex-col rounded-[28px] border p-6 shadow-sm',
								highlighted &&
									!isSubscribed &&
									'border-brand ring-brand/30 ring-2',
								isCurrent && 'border-brand',
							)}
						>
							{isCurrent ? (
								<span className="bg-brand text-brand-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold">
									Current plan
								</span>
							) : highlighted && !isSubscribed ? (
								<span className="bg-brand text-brand-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold">
									Most popular
								</span>
							) : null}
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2 className="text-foreground text-xl font-bold">
										{plan.name}
									</h2>
									<p className="text-muted-foreground mt-1 text-sm">
										{plan.summary}
									</p>
								</div>
								<div className="text-right">
									<p className={cn('text-2xl font-bold', plan.priceClassName)}>
										{plan.price}
									</p>
									<p className="text-muted-foreground text-xs">per month</p>
								</div>
							</div>
							<ul className="mt-5 flex flex-col gap-2 text-sm">
								{plan.features.map((feature) => (
									<li key={feature} className="flex items-start gap-2">
										<Icon
											name="check"
											size="sm"
											className="text-brand mt-0.5 shrink-0"
											aria-hidden="true"
										/>
										<span className="text-foreground">{feature}</span>
									</li>
								))}
							</ul>
							<div className="mt-6 flex-1" />
							{isSubscribed ? (
								isCurrent ? (
									<Button variant="secondary" asChild>
										<Link to="/manage-subscription" reloadDocument>
											Manage billing
										</Link>
									</Button>
								) : (
									<Button variant="secondary" asChild>
										<Link to="/manage-subscription" reloadDocument>
											Switch to {plan.name}
										</Link>
									</Button>
								)
							) : (
								<Button variant={highlighted ? 'brand' : 'secondary'} asChild>
									<a href={paymentUrls[plan.id]}>Choose {plan.name}</a>
								</Button>
							)}
						</div>
					)
				})}
			</div>

			<p className="text-muted-foreground text-sm">
				{isSubscribed ? (
					<>
						Need to change plans or cancel?{' '}
						<Link
							to="/manage-subscription"
							reloadDocument
							className="text-foreground font-semibold underline underline-offset-4"
						>
							Open the billing portal
						</Link>
						.
					</>
				) : (
					<>
						Not ready yet?{' '}
						<Link
							to="/recipients"
							className="text-foreground font-semibold underline underline-offset-4"
						>
							Keep using your free trial
						</Link>
						.
					</>
				)}
			</p>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			unexpectedErrorHandler={() => (
				<ErrorMessage
					eyebrow="Billing"
					title="We could not load your subscription"
					description="Stripe did not respond. Please try again in a moment, or contact support if this keeps happening."
				/>
			)}
		/>
	)
}
