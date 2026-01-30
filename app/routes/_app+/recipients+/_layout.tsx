import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { requireUserId } from '#app/utils/auth.server.js'
import { CronParseError, getNextScheduledTime } from '#app/utils/cron.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipients = await prisma.recipient.findMany({
		select: {
			id: true,
			name: true,
			scheduleCron: true,
			timeZone: true,
			disabled: true,
			_count: { select: { messages: { where: { sentAt: null } } } },
			messages: {
				where: { sentAt: null },
				orderBy: { order: 'asc' },
				take: 1,
			},
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

	return json({ recipients: sortedRecipients })
}

export default function RecipientsLayout() {
	const { recipients } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto flex min-h-0 flex-grow flex-col px-4 pt-4 md:px-8 md:pt-8">
			<div className="mb-8 flex items-center justify-between">
				<h1 className="text-4xl font-bold">
					<Link
						to="."
						className="text-foreground hover:no-underline focus:no-underline"
					>
						Recipients
					</Link>
				</h1>
				<ButtonLink to="new" className="hidden items-center gap-2 md:flex">
					<Icon name="plus">Add New Recipient</Icon>
				</ButtonLink>
				<ButtonLink icon to="new" className="md:hidden">
					<Icon name="plus" />
				</ButtonLink>
			</div>

			<div className="bg-background-alt flex min-h-0 flex-1 flex-col">
				<div className="flex flex-col gap-4 overflow-visible border-b-2 py-4 pl-1 pr-4">
					<details
						className="rounded-lg border border-border/60 bg-background px-3 py-2 shadow-sm"
						open={recipients.length === 0}
					>
						<summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
							Recipient links
						</summary>
						<div className="mt-3 flex flex-col gap-1 pb-2">
							{recipients.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No recipients found. Add one to get started.
								</p>
							) : (
								recipients.map((recipient) => {
									const statusText = recipient.disabled
										? 'Disabled'
										: recipient.cronError
											? 'Invalid schedule'
											: recipient._count.messages > 0
												? null
												: 'No messages'
									const statusTone = recipient.cronError
										? 'text-destructive'
										: 'text-muted-foreground'
									const statusTitle = recipient.cronError
										? `Invalid cron: ${recipient.cronError}`
										: undefined

									return (
										<NavLink
											key={recipient.id}
											to={recipient.id}
											preventScrollReset
											className={({ isActive }) =>
												cn(
													'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors',
													'hover:bg-muted/60 hover:text-foreground',
													'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
													isActive
														? 'bg-muted text-foreground font-semibold'
														: 'text-muted-foreground',
												)
											}
										>
											<span className="min-w-0 flex-1 truncate text-left">
												{recipient.name}
											</span>
											{statusText ? (
												<span
													className={cn('text-xs font-medium', statusTone)}
													title={statusTitle}
												>
													{statusText}
												</span>
											) : null}
										</NavLink>
									)
								})
							)}
						</div>
					</details>
				</div>
				<main className="flex-1 overflow-auto">
					<Outlet />
				</main>
			</div>
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
