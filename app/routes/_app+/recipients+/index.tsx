import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link, type MetaFunction, useOutletContext } from 'react-router'
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
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-foreground text-3xl font-bold sm:text-4xl">
					Recipients
				</h1>
				<ButtonLink
					to="new"
					variant="ghost"
					size="icon"
					aria-label="Add recipient"
					className="h-14 w-14 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] shadow-sm hover:bg-[hsl(var(--palette-green-700))]"
				>
					<span aria-hidden="true" className="text-3xl leading-none font-bold">
						+
					</span>
				</ButtonLink>
			</div>

			<div
				className={
					hasRecipients
						? 'md:border-border md:bg-card md:rounded-[32px] md:border md:shadow-sm'
						: 'border-border bg-card rounded-[32px] border shadow-sm'
				}
			>
				<div className="border-border text-muted-foreground hidden grid-cols-[minmax(160px,1.2fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px] gap-4 border-b px-8 py-4 text-xs font-semibold tracking-[0.2em] uppercase md:grid">
					<span>Recipient Name</span>
					<span>Phone Number</span>
					<span>Schedule</span>
					<span>Prepared Messages</span>
					<span />
				</div>
				{hasRecipients ? (
					<div className="md:divide-border space-y-4 md:space-y-0 md:divide-y">
						{recipients.map((recipient) => {
							const messageCount = recipient._count.messages
							const messageLabel = messageCount === 1 ? 'message' : 'messages'
							const messageText = `${messageCount} ${messageLabel}`
							const messagePreparedText = `${messageText} prepared`
							const messageTone =
								messageCount === 0
									? 'text-[hsl(var(--palette-orange))]'
									: 'text-muted-foreground'
							const scheduleTone = recipient.disabled
								? 'text-muted-foreground'
								: recipient.cronError
									? 'text-foreground-destructive'
									: 'text-muted-foreground'
							return (
								<div
									key={recipient.id}
									className="border-border bg-card flex flex-col gap-4 rounded-[24px] border px-5 py-4 shadow-sm md:grid md:grid-cols-[minmax(160px,1.2fr)_minmax(180px,1.2fr)_minmax(220px,1.4fr)_minmax(140px,0.8fr)_120px] md:items-center md:gap-4 md:rounded-none md:border-0 md:bg-transparent md:px-8 md:py-6 md:shadow-none"
								>
									<div className="flex items-start justify-between gap-4 md:flex-col md:items-start md:gap-1">
										<Link
											to={recipient.id}
											className="text-foreground text-xl font-semibold hover:underline md:text-lg"
										>
											{recipient.name}
										</Link>
										<ButtonLink
											to={recipient.id}
											variant="outline"
											size="icon"
											aria-label={`Edit ${recipient.name}`}
											className="md:hidden"
										>
											<Icon name="pencil-1" size="sm" />
										</ButtonLink>
									</div>
									<div className="hidden flex-col gap-1 md:flex">
										<span className="text-muted-foreground text-sm">
											{recipient.phoneNumber}
										</span>
									</div>
									<div className="flex items-center gap-3 text-sm md:flex-col md:items-start md:gap-1">
										<span className="bg-muted text-muted-foreground rounded-full p-2 md:hidden">
											<Icon name="clock" size="sm" />
										</span>
										<span className={`text-sm font-medium ${scheduleTone}`}>
											{recipient.scheduleDisplay}
										</span>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-sm md:flex-col md:items-start md:gap-1">
										<span className="bg-muted text-muted-foreground rounded-full p-2 md:hidden">
											<Icon name="message" size="sm" />
										</span>
										<span className={`text-sm font-semibold ${messageTone}`}>
											<span className="md:hidden">{messagePreparedText}</span>
											<span className="hidden md:inline">{messageText}</span>
										</span>
										{messageCount === 0 ? (
											<span className="rounded-full bg-[hsl(var(--palette-orange))]/15 p-1 text-[hsl(var(--palette-orange))] md:hidden">
												<Icon name="exclamation-circle-outline" size="xs" />
											</span>
										) : null}
									</div>
									<div className="hidden md:flex md:justify-end">
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
							className="flex w-full items-center justify-center gap-2 bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-green-700))] sm:w-auto"
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
