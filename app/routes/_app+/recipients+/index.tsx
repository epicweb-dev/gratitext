import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link, type MetaFunction, useOutletContext } from '@remix-run/react'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { type loader as rootLoader } from '#app/root.tsx'
import { type RecipientsOutletContext } from './_layout.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export default function RecipientsIndexRoute() {
	const { recipients, subscriptionStatus } =
		useOutletContext<RecipientsOutletContext>()
	const hasRecipients = recipients.length > 0
	const showTrialBanner = subscriptionStatus === 'none'
	const showUpgradeBanner = subscriptionStatus === 'basic'
	return (
		<div className="flex flex-col gap-8">
			{showTrialBanner ? (
				<div className="rounded-[20px] bg-[hsl(var(--palette-sunny))] px-6 py-3 text-sm font-semibold text-[hsl(var(--palette-dark-navy))]">
					Upgrade to text unlimited loved ones!{' '}
					<Link className="underline" to="/settings/profile/subscription">
						Start your free trial
					</Link>
				</div>
			) : null}
			{showUpgradeBanner ? (
				<div className="rounded-[20px] bg-[hsl(var(--palette-green-300))] px-6 py-3 text-sm font-semibold text-[hsl(var(--palette-dark-navy))]">
					Upgrade to Premium to text more loved ones.{' '}
					<Link className="underline" to="/settings/profile/subscription">
						Upgrade to Premium
					</Link>
				</div>
			) : null}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
						Recipients
					</p>
					<h1 className="text-foreground text-4xl font-bold">Recipients</h1>
				</div>
				<ButtonLink
					to="new"
					className="flex items-center gap-2 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
				>
					<Icon name="plus">Add New Recipient</Icon>
				</ButtonLink>
			</div>

			<div className="border-border bg-card rounded-[32px] border shadow-sm">
				<div className="border-border text-muted-foreground hidden grid-cols-[minmax(160px,1.2fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px] gap-4 border-b px-8 py-4 text-xs font-semibold tracking-[0.2em] uppercase md:grid">
					<span>Recipient Name</span>
					<span>Phone Number</span>
					<span>Schedule</span>
					<span>Prepared Messages</span>
					<span />
				</div>
				{hasRecipients ? (
					<div className="divide-border divide-y">
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
										<span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase md:hidden">
											Recipient Name
										</span>
										<Link
											to={recipient.id}
											className="text-foreground text-lg font-semibold hover:underline"
										>
											{recipient.name}
										</Link>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase md:hidden">
											Phone Number
										</span>
										<span className="text-muted-foreground text-sm">
											{recipient.phoneNumber}
										</span>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase md:hidden">
											Schedule
										</span>
										<span className={`text-sm ${scheduleTone}`}>
											{recipient.scheduleDisplay}
										</span>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase md:hidden">
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
					<div className="text-body-sm text-muted-foreground flex flex-col items-center gap-4 px-8 py-16 text-center">
						<div>
							<p className="text-foreground text-base font-semibold">
								Start by adding your first recipient
							</p>
							<p className="mt-1">
								Add someone you want to keep in touch with.
							</p>
						</div>
						<ButtonLink
							to="new"
							className="flex items-center gap-2 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))]"
						>
							<Icon name="plus">Add Recipient</Icon>
						</ButtonLink>
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
