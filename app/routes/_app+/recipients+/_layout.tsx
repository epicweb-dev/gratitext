import {
	data as json,
	type LoaderFunctionArgs,
	Outlet,
	useLoaderData,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.js'
import { CronParseError, getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	NEXT_SCHEDULE_SENTINEL_DATE,
	PREV_SCHEDULE_SENTINEL_DATE,
} from '#app/utils/schedule-constants.server.ts'
import { getCustomerProducts } from '#app/utils/stripe.server.ts'

function formatScheduleDisplay(date: Date, timeZone: string) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone,
		timeZoneName: 'short',
	})
	const parts = formatter.formatToParts(date)
	const getPart = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value
	const weekday = getPart('weekday') ?? ''
	const hour = getPart('hour') ?? ''
	const minute = getPart('minute') ?? '00'
	const dayPeriod = getPart('dayPeriod') ?? ''
	const timeZoneName = getPart('timeZoneName') ?? ''
	return `Every ${weekday} at ${hour}:${minute} ${dayPeriod} ${timeZoneName}`.trim()
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipients = await prisma.recipient.findMany({
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
			disabled: true,
			prevScheduledAt: true,
			nextScheduledAt: true,
			_count: { select: { messages: { where: { sentAt: null } } } },
		},
		where: { userId },
	})

	const now = new Date()
	const scheduleUpdates: Array<{
		id: string
		prevScheduledAt: Date
		nextScheduledAt: Date
	}> = []

	// Ensure we have a schedule window for sorting/display
	const sortedRecipients = recipients
		.map((recipient) => {
			let nextScheduledAt = recipient.nextScheduledAt
			let prevScheduledAt = recipient.prevScheduledAt
			// Check if current value is the sentinel date (invalid schedule)
			const isSentinel =
				nextScheduledAt?.getTime() === NEXT_SCHEDULE_SENTINEL_DATE.getTime()
			try {
				if (
					!nextScheduledAt ||
					!prevScheduledAt ||
					nextScheduledAt <= now ||
					isSentinel
				) {
					const scheduleWindow = getScheduleWindow(
						recipient.scheduleCron,
						recipient.timeZone,
						now,
					)
					nextScheduledAt = scheduleWindow.nextScheduledAt
					prevScheduledAt = scheduleWindow.prevScheduledAt
					const needsUpdate =
						!recipient.nextScheduledAt ||
						!recipient.prevScheduledAt ||
						recipient.nextScheduledAt.getTime() !== nextScheduledAt.getTime() ||
						recipient.prevScheduledAt.getTime() !== prevScheduledAt.getTime()
					if (needsUpdate) {
						scheduleUpdates.push({
							id: recipient.id,
							prevScheduledAt,
							nextScheduledAt,
						})
					}
				}
				return {
					...recipient,
					prevScheduledAt,
					nextScheduledAt,
					cronError: null as string | null,
				}
			} catch (error) {
				// Use sentinel dates for invalid schedules, update if needed
				const needsSentinelUpdate =
					!recipient.nextScheduledAt ||
					recipient.nextScheduledAt.getTime() !==
						NEXT_SCHEDULE_SENTINEL_DATE.getTime()
				if (needsSentinelUpdate) {
					scheduleUpdates.push({
						id: recipient.id,
						prevScheduledAt: PREV_SCHEDULE_SENTINEL_DATE,
						nextScheduledAt: NEXT_SCHEDULE_SENTINEL_DATE,
					})
				}
				return {
					...recipient,
					prevScheduledAt: prevScheduledAt ?? PREV_SCHEDULE_SENTINEL_DATE,
					nextScheduledAt: NEXT_SCHEDULE_SENTINEL_DATE, // Sentinel date for sorting
					cronError:
						error instanceof CronParseError ? error.message : 'Invalid cron',
				}
			}
		})
		.sort((a, b) => {
			// Put disabled recipients at the bottom
			if (a.disabled !== b.disabled) {
				return a.disabled ? 1 : -1
			}
			// Then sort by next scheduled time
			return a.nextScheduledAt.getTime() - b.nextScheduledAt.getTime()
		})

	if (scheduleUpdates.length) {
		await prisma.$transaction(
			scheduleUpdates.map((update) =>
				prisma.recipient.update({
					where: { id: update.id },
					data: {
						prevScheduledAt: update.prevScheduledAt,
						nextScheduledAt: update.nextScheduledAt,
					},
				}),
			),
		)
	}

	const recipientsWithDisplay = sortedRecipients.map((recipient) => {
		const scheduleDisplay = recipient.disabled
			? 'Paused'
			: recipient.cronError
				? 'Schedule issue'
				: formatScheduleDisplay(recipient.nextScheduledAt, recipient.timeZone)
		const { nextScheduledAt, ...rest } = recipient
		return { ...rest, scheduleDisplay }
	})

	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { stripeId: true },
	})
	const productsData = user.stripeId
		? await getCustomerProducts(user.stripeId)
		: { products: [], cancelAt: null }
	const subscriptionStatus = productsData.products.includes('premium')
		? 'premium'
		: productsData.products.includes('basic')
			? 'basic'
			: 'none'

	return json({ recipients: recipientsWithDisplay, subscriptionStatus })
}

type LoaderData = Awaited<ReturnType<typeof loader>>['data']

export type RecipientsOutletContext = {
	recipients: LoaderData['recipients']
	subscriptionStatus: LoaderData['subscriptionStatus']
}

export default function RecipientsLayout() {
	const { recipients, subscriptionStatus } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto flex min-h-0 flex-grow flex-col px-4 pt-10 pb-16 md:px-8">
			<Outlet context={{ recipients, subscriptionStatus }} />
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>
						No user with the recipient with the id "{params.recipientId}" exists
					</p>
				),
			}}
		/>
	)
}
