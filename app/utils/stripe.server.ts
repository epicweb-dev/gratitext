import { invariantResponse } from '@epic-web/invariant'
import { z } from 'zod'
import { cache, cachified } from './cache.server.ts'

const SessionSchema = z.object({
	customer: z.string(),
})

export async function getCustomerIdFromSession(sessionId: string) {
	const response = await fetch(
		`https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
		{ headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } },
	)
	invariantResponse(response.ok, 'Failed to retrieve session details')
	const json = await response.json()

	const result = SessionSchema.safeParse(json)
	invariantResponse(result.success, () => result.error?.issues.join('\n') ?? '')

	return result.data.customer
}

const SubscriptionSchema = z.object({
	data: z.array(
		z.object({
			items: z.object({
				data: z.array(
					z.object({
						plan: z.object({ product: z.string() }),
					}),
				),
			}),
		}),
	),
})

const ProductsSchema = z.array(z.enum(['basic', 'premium']))

const ProductMap = {
	[process.env.STRIPE_BASIC_PRODUCT]: 'basic',
	[process.env.STRIPE_PREMIUM_PRODUCT]: 'premium',
} as const

export async function getCustomerProducts(customerId: string) {
	const products = await cachified({
		key: `customer-products-${customerId}`,
		cache,
		checkValue: ProductsSchema,
		ttl: 1000 * 10,
		swr: 1000 * 60 * 60 * 24 * 7,
		getFreshValue: async () => {
			const params = new URLSearchParams({
				customer: customerId,
			})
			const response = await fetch(
				`https://api.stripe.com/v1/subscriptions?${params}`,
				{
					headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
				},
			)
			if (!response.ok) {
				throw new Error('Failed to retrieve customer products')
			}
			const json = await response.json()
			const { data } = SubscriptionSchema.parse(json)
			const products = data
				.flatMap(d => d.items.data.map(i => ProductMap[i.plan.product]))
				.filter(Boolean)
			return products
		},
	})

	return products
}
