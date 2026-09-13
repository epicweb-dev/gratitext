import { useEffect, useRef } from 'react'
import {
	Link,
	Outlet,
	data as json,
	type LoaderFunctionArgs,
	type MetaFunction,
	useLoaderData,
} from 'react-router'
import {
	ErrorMessage,
	GeneralErrorBoundary,
} from '#app/components/error-boundary.js'
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

	const hasBadges = data.optedOut || !data.recipient.verified

	return (
		<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:gap-10">
			<aside className="flex flex-col gap-5 lg:sticky lg:top-28">
				<Link
					to="/recipients"
					className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 text-sm font-semibold transition-colors"
					ref={firstLinkRef}
				>
					<Icon name="arrow-left" size="sm" aria-hidden="true" />
					All recipients
				</Link>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="text-foreground font-serif text-3xl font-semibold break-words sm:text-4xl">
							{data.recipient.name}
						</h1>
						{hasBadges ? (
							<div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase">
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
						) : null}
					</div>
					<ButtonLink
						variant="secondary"
						size="sm"
						to="edit"
						className="gap-2"
						aria-label={`Edit ${data.recipient.name}`}
					>
						<Icon name="settings" size="sm" aria-hidden="true" />
						Edit
					</ButtonLink>
				</div>
				<dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
					<div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm">
						<span className="bg-muted text-muted-foreground rounded-xl p-2">
							<Icon name="phone" size="sm" aria-hidden="true" />
						</span>
						<div className="min-w-0">
							<dt className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.15em] uppercase">
								Phone
							</dt>
							<dd className="text-foreground truncate text-sm font-medium">
								{data.recipient.phoneNumber}
							</dd>
						</div>
					</div>
					<div
						className={cn(
							'border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm',
							data.cronError && 'border-destructive/40',
						)}
					>
						<span className="bg-muted text-muted-foreground rounded-xl p-2">
							<Icon name="clock" size="sm" aria-hidden="true" />
						</span>
						<div className="min-w-0">
							<dt className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.15em] uppercase">
								{data.cronError ? 'Schedule issue' : 'Next send'}
							</dt>
							<dd
								className={cn(
									'text-foreground truncate text-sm font-medium',
									data.cronError && 'text-foreground-destructive',
								)}
								title={data.cronError ?? undefined}
							>
								{data.formattedNextSendTime}
							</dd>
						</div>
					</div>
				</dl>
			</aside>
			<section className="border-border bg-card min-w-0 rounded-[28px] border p-4 shadow-sm sm:p-6 lg:p-8">
				<Outlet />
			</section>
		</div>
	)
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
