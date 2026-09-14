import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link, type MetaFunction, useOutletContext } from 'react-router'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { type loader as rootLoader } from '#app/root.tsx'
import { cn } from '#app/utils/misc.tsx'
import {
	type RecipientsOutletContext,
	type ScheduleDisplay,
} from './_layout.tsx'

export const handle: SEOHandle & { pageTint: 'surface' } = {
	getSitemapEntries: () => null,
	pageTint: 'surface',
}

const gridColumns =
	'md:grid-cols-[minmax(7rem,0.9fr)_minmax(9rem,1.4fr)_minmax(10rem,1.5fr)_minmax(8rem,1.2fr)_auto]'

export default function RecipientsIndexRoute() {
	const { recipients } = useOutletContext<RecipientsOutletContext>()
	const hasRecipients = recipients.length > 0
	return (
		<div className="container flex flex-1 flex-col pt-7 pb-10 md:pt-10 md:pb-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-display text-foreground md:text-h2 text-[2rem] leading-none">
					Recipients
				</h1>
				<ButtonLink
					to="new"
					variant="brand"
					className="h-14 w-14 p-0 md:h-12 md:w-auto md:px-5"
				>
					<Icon name="plus" size="sm" aria-hidden="true" />
					<span className="sr-only md:not-sr-only">Add New Recipient</span>
				</ButtonLink>
			</div>

			{hasRecipients ? (
				<>
					<div
						className={cn(
							'text-subtle-foreground text-label mt-8 hidden gap-4 px-2 pb-3 uppercase md:grid',
							gridColumns,
						)}
					>
						<span>Recipient Name</span>
						<span>Phone Number</span>
						<span>Schedule</span>
						<span>Prepared Messages</span>
						<span className="sr-only">Actions</span>
					</div>
					<ul className="md:bg-card md:dark:bg-background md:dark:border-border flex flex-col gap-3 md:flex-none md:rounded-[1.5rem] md:px-6 md:pb-6 md:dark:border">
						{recipients.map((recipient) => {
							const messageCount = recipient.messageCount
							const queueEmpty = messageCount === 0
							const countLabel = `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`
							return (
								<li
									key={recipient.id}
									className={cn(
										'bg-card relative flex flex-col gap-4 rounded-[1.25rem] px-6 py-5 md:grid md:min-h-[5.5rem] md:items-center md:gap-4 md:rounded-none md:border-b md:bg-transparent md:px-0 md:py-3 md:last:border-b-0 md:dark:bg-transparent',
										gridColumns,
									)}
								>
									<div className="flex items-start justify-between gap-3 md:contents">
										<Link
											to={recipient.id}
											prefetch="intent"
											className="text-foreground min-w-0 truncate text-lg font-semibold after:absolute after:inset-0 after:content-[''] md:pl-6 md:text-sm md:after:hidden"
										>
											{recipient.name}
										</Link>
										<p className="text-foreground hidden min-w-0 truncate text-sm md:block">
											{recipient.phoneNumber}
										</p>
										<ButtonLink
											to={`${recipient.id}/edit`}
											variant="outline"
											size="icon"
											className="relative z-10 shrink-0 md:hidden"
											aria-label={`Manage ${recipient.name}`}
										>
											<Icon name="pencil-1" size="sm" aria-hidden="true" />
										</ButtonLink>
									</div>
									<p className="text-foreground flex min-w-0 items-center gap-3 text-base md:text-sm">
										<Icon
											name="clock"
											size="sm"
											aria-hidden="true"
											className="text-muted-foreground shrink-0 md:hidden"
										/>
										<Schedule display={recipient.scheduleDisplay} />
									</p>
									<p
										className={cn(
											'flex min-w-0 items-center gap-3 text-base md:text-sm',
											queueEmpty
												? 'text-foreground-destructive'
												: 'text-foreground',
										)}
									>
										<Icon
											name="message"
											size="sm"
											aria-hidden="true"
											className="text-muted-foreground shrink-0 md:hidden"
										/>
										<span>
											{countLabel}
											<span className="md:hidden"> prepared</span>
										</span>
										{queueEmpty ? (
											<span
												className="bg-destructive/20 text-foreground-destructive inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
												aria-label="No messages prepared"
											>
												!
											</span>
										) : null}
									</p>
									<div className="hidden justify-end md:flex md:pr-2">
										<ButtonLink
											to={`${recipient.id}/edit`}
											variant="outline"
											className="relative z-10 h-12 px-5 text-xs"
										>
											<Icon name="pencil-1" size="xs" aria-hidden="true" />
											Manage
										</ButtonLink>
									</div>
								</li>
							)
						})}
					</ul>
				</>
			) : (
				<div className="bg-card md:dark:bg-background md:dark:border-border mt-8 flex flex-1 flex-col items-center justify-center gap-5 rounded-[1.5rem] px-6 py-24 text-center md:min-h-[27rem] md:flex-none md:dark:border">
					<h2 className="font-display text-foreground text-xl md:text-[1.375rem]">
						Start By Adding Your First Recipient
					</h2>
					<ButtonLink to="new" variant="outline" className="h-12 px-5 text-xs">
						Add New Recipient
						<Icon name="plus" size="xs" aria-hidden="true" />
					</ButtonLink>
				</div>
			)}
		</div>
	)
}

function Schedule({ display }: { display: ScheduleDisplay }) {
	switch (display.kind) {
		case 'paused':
			return <span className="text-muted-foreground">Paused</span>
		case 'error':
			return (
				<span className="text-foreground-destructive" title={display.message}>
					Schedule issue
				</span>
			)
		case 'weekly':
			return (
				<span className="truncate">
					Every <strong className="font-semibold">{display.weekday}</strong> at{' '}
					{display.time} {display.timeZoneName}
				</span>
			)
		default: {
			const exhaustive: never = display
			return exhaustive
		}
	}
}

export const meta: MetaFunction<null, { root: typeof rootLoader }> = ({
	matches,
}) => {
	const rootMatch = matches.find((m) => m.id === 'root')
	const displayName = rootMatch?.data?.user?.name ?? 'Unknown User'
	return [
		{ title: `${displayName}'s Recipients | GratiText` },
		{
			name: 'description',
			content: `${displayName}'s recipients on GratiText`,
		},
	]
}
