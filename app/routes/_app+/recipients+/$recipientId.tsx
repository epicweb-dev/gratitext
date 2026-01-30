import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs, type MetaFunction } from 'react-router'
import { Link, Outlet, json, useLoaderData, useMatches } from 'react-router'
import { useEffect, useRef } from 'react'
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
		where: { id: params.recipientId, userId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
			verified: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })
	const optedOut = await prisma.optOut.findUnique({
		where: { phoneNumber: recipient.phoneNumber },
		select: { id: true },
	})

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
		recipient,
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
	const matches = useMatches()
	const lastMatch = matches[matches.length - 1]
	const idPortion = lastMatch?.id.split('.')?.at(-1) ?? '.'
	const currentPath = idPortion === 'index' ? '.' : idPortion

	useEffect(() => {
		firstLinkRef.current?.focus()
	}, [data.recipient.id])

	useEffect(() => {
		if (currentPath === '.') firstLinkRef.current?.focus()
	}, [currentPath])

	return (
		<div className="grid gap-10 lg:grid-cols-[320px_1fr]">
			<aside className="space-y-6">
				<Link
					to="/recipients"
					className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
				>
					<Icon name="arrow-left" size="sm" />
					All Recipients
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 className="text-3xl font-bold text-foreground">
							{data.recipient.name}
						</h2>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							<span>{data.recipient.phoneNumber}</span>
							{data.optedOut ? (
								<span className="rounded-full bg-destructive/10 px-3 py-1 text-foreground-destructive">
									Opted out
								</span>
							) : null}
							{data.recipient.verified ? null : (
								<Link
									preventScrollReset
									to="edit"
									className="rounded-full border border-destructive/40 px-3 py-1 text-foreground-destructive"
								>
									Unverified
								</Link>
							)}
						</div>
					</div>
					<ButtonLink variant="secondary" to="edit" className="gap-2">
						<Icon name="settings">Settings</Icon>
					</ButtonLink>
				</div>
				<div className="space-y-3">
					<div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
						<span className="rounded-xl bg-muted p-2 text-muted-foreground">
							<Icon name="phone" size="sm" />
						</span>
						<span className="text-sm font-medium text-foreground">
							{data.recipient.phoneNumber}
						</span>
					</div>
					<SimpleTooltip
						content={
							data.cronError ? `Cron error: ${data.cronError}` : 'Next send time'
						}
					>
						<div
							className={cn(
								'flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm',
								data.cronError && 'text-foreground-destructive',
							)}
						>
							<span className="rounded-xl bg-muted p-2 text-muted-foreground">
								<Icon name="clock" size="sm" />
							</span>
							<span>{data.formattedNextSendTime}</span>
						</div>
					</SimpleTooltip>
				</div>
			</aside>
			<section className="rounded-[32px] border border-border bg-muted px-6 py-8 shadow-sm">
				<nav className="mb-6 flex flex-wrap gap-2">
					<Link
						to="."
						preventScrollReset
						className={cn(
							'flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-card hover:text-foreground',
							currentPath === '.' && 'bg-card text-foreground shadow-sm',
						)}
						ref={firstLinkRef}
					>
						<Icon name="clock" size="sm">
							Upcoming
						</Icon>
					</Link>
					<Link
						to="new"
						preventScrollReset
						className={cn(
							'flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-card hover:text-foreground',
							currentPath === 'new' && 'bg-card text-foreground shadow-sm',
						)}
					>
						<Icon name="plus" size="sm">
							New
						</Icon>
					</Link>
					<Link
						to="past"
						preventScrollReset
						className={cn(
							'flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-card hover:text-foreground',
							currentPath === 'past' && 'bg-card text-foreground shadow-sm',
						)}
					>
						<Icon name="chevron-down" size="sm">
							Past
						</Icon>
					</Link>
					<Link
						to="edit"
						preventScrollReset
						className={cn(
							'flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:bg-card hover:text-foreground',
							currentPath === 'edit' && 'bg-card text-foreground shadow-sm',
						)}
					>
						<Icon name="pencil-1" size="sm">
							Edit
						</Icon>
					</Link>
				</nav>
				<div className="overflow-y-auto">
					<Outlet />
				</div>
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
