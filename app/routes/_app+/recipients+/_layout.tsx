import {
	data as json,
	Link,
	type LoaderFunctionArgs,
	Outlet,
	useLoaderData,
} from 'react-router'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { requireUserId } from '#app/utils/auth.server.js'
import { CronParseError, getScheduleWindow } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getunsentmessagecounts } from '#app/utils/prisma-generated.server/sql.ts'
import {
	NEXT_SCHEDULE_SENTINEL_DATE,
	PREV_SCHEDULE_SENTINEL_DATE,
} from '#app/utils/schedule-constants.server.ts'
import { getSubscriptionTier } from '#app/utils/stripe.server.ts'

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
	const time = minute === '00' ? hour : `${hour}:${minute}`
	return {
		weekday,
		time: `${time} ${dayPeriod}`.trim(),
		timeZoneName,
	}
}

export type ScheduleDisplay =
	| { kind: 'paused' }
	| { kind: 'error'; message: string }
	| { kind: 'weekly'; weekday: string; time: string; timeZoneName: string }

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
		},
		where: {
			userId,
		},
		orderBy: { id: 'asc' },
	})
	const recipientIds = recipients.map((recipient) => recipient.id)
	const messageCounts = recipientIds.length
		? await prisma.$queryRawTyped(
				getunsentmessagecounts(JSON.stringify(recipientIds)),
			)
		: []
	const messageCountByRecipientId = new Map(
		messageCounts.map((row) => [row.recipientId, Number(row.unsentCount ?? 0)]),
	)
	const recipientsWithCounts = recipients.map((recipient) => ({
		...recipient,
		messageCount: messageCountByRecipientId.get(recipient.id) ?? 0,
	}))

	const now = new Date()
	const scheduleUpdates: Array<{
		id: string
		prevScheduledAt: Date
		nextScheduledAt: Date
	}> = []

	// Ensure we have a schedule window for sorting/display
	const sortedRecipients = recipientsWithCounts
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
					!recipient.prevScheduledAt ||
					recipient.nextScheduledAt.getTime() !==
						NEXT_SCHEDULE_SENTINEL_DATE.getTime() ||
					recipient.prevScheduledAt.getTime() !==
						PREV_SCHEDULE_SENTINEL_DATE.getTime()
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
		const scheduleDisplay: ScheduleDisplay = recipient.disabled
			? { kind: 'paused' }
			: recipient.cronError
				? { kind: 'error', message: recipient.cronError }
				: {
						kind: 'weekly',
						...formatScheduleDisplay(
							recipient.nextScheduledAt,
							recipient.timeZone,
						),
					}
		const { nextScheduledAt, ...rest } = recipient
		return { ...rest, scheduleDisplay }
	})

	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { stripeId: true },
	})
	const subscriptionStatus = await getSubscriptionTier(user.stripeId)

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
		<main className="flex min-h-0 flex-grow flex-col">
			{subscriptionStatus === 'none' ? <TrialBanner /> : null}
			<Outlet context={{ recipients, subscriptionStatus }} />
		</main>
	)
}

function TrialBanner() {
	return (
		<div className="bg-warning text-warning-foreground">
			<div className="container flex flex-col items-center justify-center gap-3 py-3 text-center text-sm font-medium md:h-[4.5rem] md:flex-row md:gap-4 md:py-0">
				<p>Upgrade to start sending your scheduled messages.</p>
				<Button
					asChild
					variant="inverse"
					size="xs"
					className="h-9 px-4 text-xs"
				>
					<Link to="/settings/profile/subscription">
						Start my 14 Day FREE Trial
					</Link>
				</Button>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<ErrorMessage
						eyebrow="Error 404"
						title="Recipient not found"
						description={`No recipient with the id "${params.recipientId}" exists.`}
					/>
				),
			}}
		/>
	)
}
