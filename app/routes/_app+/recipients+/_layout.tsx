import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
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
	const [isOpen, setIsOpen] = useState(false)

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
					<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
						<DropdownMenuTrigger className="hover:bg-background-alt-hover cursor-pointer px-2 py-1">
							<Icon name="chevron-down">Select recipient</Icon>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="min-w-64">
							{recipients.map((recipient) => (
								<DropdownMenuItem asChild key={recipient.id}>
									<NavLink
										to={recipient.id}
										preventScrollReset
										onClick={() => setIsOpen(false)}
										className={cn(
											'flex w-full items-center gap-2 overflow-x-auto rounded-sm px-2 py-1.5 text-xl transition-colors',
											'hover:bg-accent hover:text-accent-foreground',
											'focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
										)}
									>
										{({ isActive }) => (
											<div className="flex items-center gap-1">
												<Icon
													name="arrow-right"
													size="sm"
													className={cn(
														isActive ? 'opacity-100' : 'opacity-0',
														'transition-opacity',
													)}
												/>
												{recipient.name}
												{recipient.disabled ? (
													<SimpleTooltip content="Recipient is disabled">
														<Icon
															name="lock-closed"
															className="text-muted-foreground"
															title="recipient is disabled"
														/>
													</SimpleTooltip>
												) : recipient.cronError ? (
													<SimpleTooltip
														content={`Invalid cron: ${recipient.cronError}`}
													>
														<Icon
															name="exclamation-circle-outline"
															className="text-destructive"
															title="invalid cron schedule"
														/>
													</SimpleTooltip>
												) : recipient._count.messages > 0 ? null : (
													<SimpleTooltip content="No messages scheduled">
														<Icon
															name="exclamation-circle-outline"
															className="text-danger-foreground"
															title="no messages scheduled"
														/>
													</SimpleTooltip>
												)}
											</div>
										)}
									</NavLink>
								</DropdownMenuItem>
							))}
							{recipients.length === 0 && (
								<div className="bg-warning-background text-warning-foreground px-4 py-2 text-sm">
									No recipients found. Add one to get started.
								</div>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
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
