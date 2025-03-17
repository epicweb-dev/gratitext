import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { SimpleTooltip } from '#app/components/ui/tooltip.js'
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
						className="relative"
						onBlur={(e) => {
							const relatedTarget = e.relatedTarget
							if (!e.currentTarget.contains(relatedTarget)) {
								const el = e.currentTarget
								// seems to cause the browser to crash if relatedTarget is null
								// (like clicking within the details, but not on anything in particular)
								// so we wrap it in a requestAnimationFrame and it closes fine.
								requestAnimationFrame(() => {
									el.removeAttribute('open')
								})
							}
						}}
						onKeyDown={(e) => {
							if (e.key === 'Escape') {
								e.currentTarget.removeAttribute('open')
							}
						}}
					>
						<summary className="hover:bg-background-alt-hover cursor-pointer px-2 py-1">
							Select recipient
						</summary>
						<div className="bg-background-alt absolute left-0 top-full z-10 mt-1 min-w-64 max-w-full border p-2 shadow-lg">
							{recipients.map((recipient) => (
								<NavLink
									key={recipient.id}
									to={recipient.id}
									className={({ isActive }) =>
										cn(
											'flex items-center gap-2 overflow-x-auto text-xl hover:bg-background',
											isActive ? 'underline' : '',
										)
									}
									onClick={(e) => {
										e.currentTarget.closest('details')?.removeAttribute('open')
									}}
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
											{recipient._count.messages > 0 ? null : (
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
							))}
							{recipients.length === 0 && (
								<div className="bg-warning-background text-warning-foreground px-4 py-2 text-sm">
									No recipients found. Add one to get started.
								</div>
							)}
						</div>
					</details>
				</div>
				<div className="flex flex-1 overflow-auto">
					<Outlet />
				</div>
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
