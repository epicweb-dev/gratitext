import { json, type LoaderFunctionArgs, type SerializeFrom } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.js'
import { CronParseError, getNextScheduledTime } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'

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
			_count: { select: { messages: { where: { sentAt: null } } } },
		},
		where: { userId },
	})

	// Calculate next scheduled time for each recipient and sort
	const sortedRecipients = recipients
		.map((recipient) => {
			try {
				return {
					...recipient,
					nextScheduledAt: getNextScheduledTime(
						recipient.scheduleCron,
						recipient.timeZone,
					),
					cronError: null as string | null,
				}
			} catch (error) {
				return {
					...recipient,
					nextScheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // Far future date for sorting
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

	const recipientsWithDisplay = sortedRecipients.map((recipient) => {
		const scheduleDisplay = recipient.disabled
			? 'Paused'
			: recipient.cronError
				? 'Schedule issue'
				: formatScheduleDisplay(recipient.nextScheduledAt, recipient.timeZone)
		const { nextScheduledAt, ...rest } = recipient
		return { ...rest, scheduleDisplay }
	})

	return json({ recipients: recipientsWithDisplay })
}

export type RecipientsOutletContext = {
	recipients: SerializeFrom<typeof loader>['recipients']
}

export default function RecipientsLayout() {
	const { recipients } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto flex min-h-0 flex-grow flex-col px-4 pb-16 pt-10 md:px-8">
			<Outlet context={{ recipients }} />
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
