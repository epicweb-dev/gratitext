import { useEffect, useRef } from 'react'
import {
	Link,
	Outlet,
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.js'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { getHints } from '#app/utils/client-hints.js'
import {
	CronParseError,
	formatSendTime,
	getSendTime,
} from '#app/utils/cron.server.js'
import { prisma } from '#app/utils/db.server.js'
import { cn } from '#app/utils/misc.tsx'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId },
		select: {
			id: true,
			userId: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
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

	let formattedNextSendTime: string
	let cronError: string | null = null
	try {
		formattedNextSendTime = formatSendTime(
			getSendTime(recipient.scheduleCron, { tz: recipient.timeZone }, 0),
			hints.timeZone || recipient.timeZone,
		)
	} catch (error) {
		if (error instanceof CronParseError) {
			formattedNextSendTime = `Invalid cron: ${error.cronString}`
			cronError = error.message
		} else {
			formattedNextSendTime = 'Invalid schedule'
			cronError = error instanceof Error ? error.message : 'Unknown error'
		}
	}

	return json({
		optedOut: Boolean(optedOut),
		recipient: recipientData,
		formattedNextSendTime,
		cronError,
	})
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
	const firstLinkRef = useRef<HTMLAnchorElement | null>(null)

	useEffect(() => {
		firstLinkRef.current?.focus()
	}, [data.recipient.id])

	return (
		<div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:gap-10">
			<aside className="space-y-6">
				<div className="flex items-center justify-between">
					<Link
						to="/recipients"
						className="text-foreground hover:text-foreground sm:text-muted-foreground inline-flex items-center gap-2 text-base font-semibold transition sm:text-xs sm:font-semibold sm:tracking-[0.2em] sm:uppercase"
						ref={firstLinkRef}
					>
						<Icon name="arrow-left" size="sm" />
						<span className="sm:hidden">{data.recipient.name}</span>
						<span className="hidden sm:inline">All Recipients</span>
					</Link>
					<ButtonLink
						variant="secondary"
						size="pill"
						to="edit"
						className="gap-2 sm:hidden"
					>
						<Icon name="settings">Settings</Icon>
					</ButtonLink>
				</div>
				<div className="hidden flex-wrap items-start justify-between gap-4 sm:flex">
					<div>
						<h2 className="text-foreground text-2xl font-bold sm:text-3xl">
							{data.recipient.name}
						</h2>
						<div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
							{data.optedOut ? (
								<span className="bg-destructive/10 text-foreground-destructive rounded-full px-3 py-1">
									Opted out
								</span>
							) : null}
							{data.recipient.verified ? null : (
								<Link
									preventScrollReset
									to="edit"
									className="border-destructive/40 text-foreground-destructive rounded-full border px-3 py-1"
								>
									Unverified
								</Link>
							)}
						</div>
					</div>
					<ButtonLink
						variant="secondary"
						size="pill"
						to="edit"
						className="gap-2"
					>
						<Icon name="settings">Settings</Icon>
					</ButtonLink>
				</div>
				<div className="hidden space-y-3 sm:block">
					<div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm">
						<span className="bg-muted text-muted-foreground rounded-xl p-2">
							<Icon name="phone" size="sm" />
						</span>
						<span className="text-foreground text-sm font-medium">
							{data.recipient.phoneNumber}
						</span>
					</div>
					<SimpleTooltip
						content={
							data.cronError
								? `Cron error: ${data.cronError}`
								: 'Next send time'
						}
					>
						<div
							className={cn(
								'border-border bg-card text-foreground flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm',
								data.cronError && 'text-foreground-destructive',
							)}
						>
							<span className="bg-muted text-muted-foreground rounded-xl p-2">
								<Icon name="clock" size="sm" />
							</span>
							<span>{data.formattedNextSendTime}</span>
						</div>
					</SimpleTooltip>
				</div>
			</aside>
			<section className="bg-card min-w-0 px-0 py-4 sm:px-6 sm:py-8">
				<Outlet />
			</section>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No recipient with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
