import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Link, Outlet, json, useLoaderData, useMatches } from '@remix-run/react'
import { useEffect, useRef } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
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
		<div className="px-10 py-6">
			<div className="flex flex-col justify-between gap-4 md:flex-row">
				<div className="mb-2 min-w-0 pt-12 lg:mb-6">
					<div className="overflow-x-auto">
						<div className="min-w-max">
							<h2 className="text-h2 whitespace-nowrap">
								{data.recipient.name}
							</h2>
							<small className="flex gap-1 text-sm font-normal text-secondary-foreground whitespace-nowrap">
								{data.recipient.phoneNumber}
								{data.optedOut ? (
									<span className="text-destructive">Opted out</span>
								) : null}
								{data.recipient.verified ? (
									''
								) : (
									<Link
										preventScrollReset
										to="edit"
										className="text-body-2xs text-destructive underline"
									>
										(unverified)
									</Link>
								)}
								<SimpleTooltip
									content={
										data.cronError
											? `Cron error: ${data.cronError}`
											: 'Next send time'
									}
								>
									<button
										className={`cursor-default ${
											data.cronError ? 'text-destructive' : ''
										}`}
									>
										{data.formattedNextSendTime}
									</button>
								</SimpleTooltip>
							</small>
						</div>
					</div>
				</div>
				<nav className="shrink-0">
					<Link
						to="."
						preventScrollReset
						className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
							currentPath === '.'
								? 'bg-accent text-accent-foreground'
								: 'hover:bg-accent/50'
						}`}
						ref={firstLinkRef}
					>
						<Icon name="clock">Upcoming</Icon>
					</Link>
					<Link
						to="new"
						preventScrollReset
						className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
							currentPath === 'new'
								? 'bg-accent text-accent-foreground'
								: 'hover:bg-accent/50'
						}`}
					>
						<Icon name="plus">New</Icon>
					</Link>
					<Link
						to="past"
						preventScrollReset
						className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
							currentPath === 'past'
								? 'bg-accent text-accent-foreground'
								: 'hover:bg-accent/50'
						}`}
					>
						<Icon name="chevron-down">Past</Icon>
					</Link>

					<Link
						to="edit"
						preventScrollReset
						className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
							currentPath === 'edit'
								? 'bg-accent text-accent-foreground'
								: 'hover:bg-accent/50'
						}`}
					>
						<Icon name="pencil-1">Edit</Icon>
					</Link>
				</nav>
			</div>
			<div className="overflow-y-auto px-4 py-6">
				<Outlet />
			</div>
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
