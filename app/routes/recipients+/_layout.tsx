import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipients = await prisma.recipient.findMany({
		select: {
			id: true,
			name: true,
			_count: { select: { messages: { where: { sentAt: null } } } },
		},
		where: { userId },
	})

	return json({ recipients })
}

export default function RecipientsRoute() {
	const data = useLoaderData<typeof loader>()
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
	return (
		<main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
			<div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<div className="relative col-span-1">
					<div className="absolute inset-0 flex flex-col">
						<div className="pb-4 pl-8 pr-4 pt-12">
							<h1 className="text-center text-base font-bold md:text-lg lg:text-left lg:text-2xl">
								Your Recipients
							</h1>
						</div>
						<ul className="overflow-y-auto overflow-x-hidden pb-12">
							<li className="p-1 pr-0">
								<NavLink
									to="new"
									className={({ isActive }) =>
										cn(navLinkDefaultClassName, isActive && 'bg-accent')
									}
								>
									<Icon name="plus">New Recipient</Icon>
								</NavLink>
							</li>
							{data.recipients.map(recipient => (
								<li key={recipient.id} className="p-1 pr-0">
									<NavLink
										to={recipient.id}
										preventScrollReset
										prefetch="intent"
										className={({ isActive }) =>
											cn(
												navLinkDefaultClassName,
												isActive && 'bg-accent',
												'flex gap-1',
											)
										}
									>
										<span>{recipient.name}</span>
										{recipient._count.messages <= 0 ? (
											<Tooltip>
												<TooltipTrigger>
													<Icon
														size="xs"
														name="exclamation-circle-outline"
														className="self-start"
													/>
												</TooltipTrigger>
												<TooltipContent>No new messages</TooltipContent>
											</Tooltip>
										) : null}
									</NavLink>
								</li>
							))}
						</ul>
					</div>
				</div>
				<div className="relative col-span-3 bg-accent md:rounded-r-3xl">
					<Outlet />
				</div>
			</div>
		</main>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}
