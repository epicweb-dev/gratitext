import {
	Link,
	Outlet,
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
	useOutletContext,
} from 'react-router'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.js'
import { SearchBar } from '#app/components/search-bar.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { prisma } from '#app/utils/db.server.js'
import { cn } from '#app/utils/misc.tsx'
import {
	type RecipientsOutletContext,
	type ScheduleDisplay,
} from './_layout.tsx'

/**
 * The thread fills the viewport and scrolls on its own, like a chat app. On
 * phones the header and thread sit on the beige "hero" tint.
 */
export const handle = { pageTint: 'hero', layout: 'fill' } as const

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId },
		select: {
			id: true,
			userId: true,
			name: true,
			phoneNumber: true,
			verified: true,
		},
	})

	if (!recipient || recipient.userId !== userId) {
		throw new Response('Not found', { status: 404 })
	}
	const optedOut = await prisma.optOut.findUnique({
		where: { phoneNumber: recipient.phoneNumber },
		select: { id: true },
	})

	const { userId: _userId, ...recipientData } = recipient

	return json({ optedOut: Boolean(optedOut), recipient: recipientData })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const { recipients } = useOutletContext<RecipientsOutletContext>()
	const scheduleDisplay = recipients.find(
		(recipient) => recipient.id === data.recipient.id,
	)?.scheduleDisplay

	const hasBadges = data.optedOut || !data.recipient.verified
	const badges = hasBadges ? (
		<div className="text-label flex flex-wrap items-center gap-2 uppercase">
			{data.optedOut ? (
				<SimpleTooltip content="This person replied STOP. Messages will not be sent until they reply START.">
					<span className="bg-destructive/10 text-foreground-destructive rounded-full px-3 py-1">
						Opted out
					</span>
				</SimpleTooltip>
			) : null}
			{data.recipient.verified ? null : (
				<Link
					preventScrollReset
					to="edit"
					className="border-destructive/40 text-foreground-destructive hover:bg-destructive/10 rounded-full border px-3 py-1 transition-colors"
				>
					Unverified · Fix
				</Link>
			)}
		</div>
	) : null

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
			{/* Phone header strip: back, name and settings on one row. */}
			<div className="bg-surface border-border shrink-0 border-y md:hidden">
				<div className="container flex min-h-[4.5rem] items-center justify-between gap-3 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<Link
							to="/recipients"
							aria-label="All recipients"
							className="text-foreground -ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
						>
							<Icon name="chevron-left" size="md" aria-hidden="true" />
						</Link>
						<div className="min-w-0">
							<h1 className="text-foreground truncate text-2xl font-bold">
								{data.recipient.name}
							</h1>
							{badges ? <div className="mt-1">{badges}</div> : null}
						</div>
					</div>
					<ButtonLink
						variant="outline"
						to="edit"
						className="h-12 shrink-0 px-5 text-sm"
						aria-label={`Settings for ${data.recipient.name}`}
					>
						<Icon name="settings" size="sm" aria-hidden="true" />
						Settings
					</ButtonLink>
				</div>
			</div>

			<div className="container flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(15rem,37fr)_minmax(0,63fr)]">
				<aside className="md:before:border-border md:before:bg-background relative isolate hidden min-h-0 flex-col gap-8 overflow-y-auto py-7 pr-8 md:flex md:before:absolute md:before:inset-y-0 md:before:right-0 md:before:-z-10 md:before:w-[60vw] md:before:border-r">
					<Link
						to="/recipients"
						className="text-subtle-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-base transition-colors"
					>
						<Icon name="chevron-left" size="sm" aria-hidden="true" />
						All Recipients
					</Link>
					<div className="flex flex-col gap-6">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<h1 className="font-display text-foreground text-[1.875rem] leading-tight break-words">
									{data.recipient.name}
								</h1>
								{badges ? <div className="mt-3">{badges}</div> : null}
							</div>
							<ButtonLink
								variant="outline"
								to="edit"
								className="h-12 shrink-0 px-5 text-sm"
								aria-label={`Settings for ${data.recipient.name}`}
							>
								<Icon name="settings" size="sm" aria-hidden="true" />
								Settings
							</ButtonLink>
						</div>
						<dl className="flex flex-col gap-3">
							<div className="flex items-center gap-5">
								<dt className="bg-muted text-muted-foreground dark:bg-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
									<Icon name="phone" size="sm" aria-hidden="true" />
									<span className="sr-only">Phone number</span>
								</dt>
								<dd className="text-foreground min-w-0 truncate text-base">
									{data.recipient.phoneNumber}
								</dd>
							</div>
							<div className="flex items-center gap-5">
								<dt
									className={cn(
										'bg-muted text-muted-foreground dark:bg-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
										scheduleDisplay?.kind === 'error' &&
											'bg-destructive/10 text-foreground-destructive',
									)}
								>
									<Icon name="clock" size="sm" aria-hidden="true" />
									<span className="sr-only">Schedule</span>
								</dt>
								<dd className="text-foreground min-w-0 text-base">
									<Schedule display={scheduleDisplay} />
								</dd>
							</div>
						</dl>
					</div>
					<details className="group text-sm">
						<summary className="text-muted-foreground hover:text-foreground inline-flex w-fit cursor-pointer list-none items-center gap-2 transition-colors [&::-webkit-details-marker]:hidden">
							<Icon name="magnifying-glass" size="sm" aria-hidden="true" />
							Search message history
							<Icon
								name="chevron-down"
								size="xs"
								aria-hidden="true"
								className="transition-transform group-open:rotate-180"
							/>
						</summary>
						<div className="mt-4">
							<SearchBar status="idle" autoSubmit showDateFilter />
						</div>
					</details>
				</aside>
				<section
					aria-label="Messages"
					className="md:after:thread-gradient relative isolate flex min-h-0 flex-1 flex-col md:pl-3 md:after:absolute md:after:inset-y-0 md:after:left-0 md:after:-z-10 md:after:w-[70vw]"
				>
					<Outlet />
				</section>
			</div>
		</div>
	)
}

function Schedule({ display }: { display: ScheduleDisplay | undefined }) {
	if (!display) return <span className="text-muted-foreground">Schedule</span>
	switch (display.kind) {
		case 'paused':
			return <span className="text-muted-foreground">Schedule paused</span>
		case 'error':
			return (
				<Link
					to="edit"
					className="text-foreground-destructive underline-offset-4 hover:underline"
					title={display.message}
				>
					Schedule needs attention
				</Link>
			)
		case 'weekly':
			return (
				<span>
					Every {display.weekday} at {display.time} {display.timeZoneName}
				</span>
			)
		default: {
			const exhaustive: never = display
			return exhaustive
		}
	}
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => (
					<ErrorMessage
						eyebrow="Error 403"
						title="You are not allowed to do that"
					/>
				),
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
