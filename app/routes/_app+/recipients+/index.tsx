import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { type SerializeFrom } from '@remix-run/node'
import { Link, type MetaFunction, useOutletContext } from '@remix-run/react'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { type loader as rootLoader } from '#app/root.tsx'
import { type loader as recipientsLoader } from './_layout.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export default function RecipientsIndexRoute() {
	const { recipients } =
		useOutletContext<SerializeFrom<typeof recipientsLoader>>()
	const hasRecipients = recipients.length > 0
	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
						Recipients
					</p>
					<h1 className="text-4xl font-bold text-foreground">Recipients</h1>
				</div>
				<ButtonLink
					to="new"
					className="flex items-center gap-2 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
				>
					<Icon name="plus">Add New Recipient</Icon>
				</ButtonLink>
			</div>

			<div className="rounded-[32px] border border-border bg-card shadow-sm">
				<div className="hidden grid-cols-[minmax(160px,1.2fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px] gap-4 border-b border-border px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:grid">
					<span>Recipient Name</span>
					<span>Phone Number</span>
					<span>Schedule</span>
					<span>Prepared Messages</span>
					<span />
				</div>
				{hasRecipients ? (
					<div className="divide-y divide-border">
						{recipients.map((recipient) => {
							const messageCount = recipient._count.messages
							const messageLabel = messageCount === 1 ? 'message' : 'messages'
							const scheduleTone = recipient.disabled
								? 'text-muted-foreground'
								: recipient.cronError
									? 'text-foreground-destructive'
									: 'text-foreground'
							return (
								<div
									key={recipient.id}
									className="grid gap-3 px-6 py-6 md:grid-cols-[minmax(160px,1.2fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px] md:items-center md:gap-4 md:px-8"
								>
									<div className="flex flex-col gap-1">
										<span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
											Recipient Name
										</span>
										<Link
											to={recipient.id}
											className="text-lg font-semibold text-foreground hover:underline"
										>
											{recipient.name}
										</Link>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
											Phone Number
										</span>
										<span className="text-sm text-muted-foreground">
											{recipient.phoneNumber}
										</span>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
											Schedule
										</span>
										<span className={`text-sm ${scheduleTone}`}>
											{recipient.scheduleDisplay}
										</span>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
											Prepared Messages
										</span>
										<span
											className={`text-sm font-semibold ${
												messageCount === 0
													? 'text-[hsl(var(--palette-orange))]'
													: 'text-foreground'
											}`}
										>
											{messageCount} {messageLabel}
										</span>
									</div>
									<div className="flex md:justify-end">
										<ButtonLink variant="secondary" size="sm" to={recipient.id}>
											<Icon name="pencil-1">Manage</Icon>
										</ButtonLink>
									</div>
								</div>
							)
						})}
					</div>
				) : (
					<div className="px-8 py-16 text-center text-body-sm text-muted-foreground">
						No recipients yet.{' '}
						<Link to="new" className="text-foreground underline">
							Add one to get started.
						</Link>
					</div>
				)}
			</div>
		</div>
	)
}

export const meta: MetaFunction<null, { root: typeof rootLoader }> = ({
	matches,
}) => {
	const rootMatch = matches.find((m) => m.id === 'root')
	const displayName = rootMatch?.data?.user?.name ?? 'Unkown User'
	return [
		{ title: `${displayName}'s Recipients | GratiText` },
		{
			name: 'description',
			content: `${displayName}'s recipients on GratiText`,
		},
	]
}
