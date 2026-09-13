import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Link, type MetaFunction, useOutletContext } from 'react-router'
import { ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { type loader as rootLoader } from '#app/root.tsx'
import { cn } from '#app/utils/misc.tsx'
import { type RecipientsOutletContext } from './_layout.tsx'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const gridColumns =
	'md:grid-cols-[minmax(180px,1.3fr)_minmax(200px,1.3fr)_minmax(120px,0.9fr)_auto]'

export default function RecipientsIndexRoute() {
	const { recipients, subscriptionStatus } =
		useOutletContext<RecipientsOutletContext>()
	const hasRecipients = recipients.length > 0
	const showTrialBanner = subscriptionStatus === 'none'
	const showUpgradeBanner = subscriptionStatus === 'basic'
	return (
		<div className="flex flex-col gap-8">
			{showTrialBanner ? (
				<PlanBanner
					tone="trial"
					message="Start your free trial to begin sending messages."
					cta="Start your free trial"
				/>
			) : null}
			{showUpgradeBanner ? (
				<PlanBanner
					tone="upgrade"
					message="On Basic you can send one message a day. Premium unlocks up to ten."
					cta="Upgrade to Premium"
				/>
			) : null}
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-foreground font-serif text-3xl font-semibold sm:text-4xl">
						Recipients
					</h1>
					<p className="text-muted-foreground mt-1 text-sm sm:text-base">
						The people you send gratitude to, and when they hear from you.
					</p>
				</div>
				{hasRecipients ? (
					<ButtonLink to="new" variant="brand" className="gap-2">
						<Icon name="plus" size="sm" aria-hidden="true" />
						Add recipient
					</ButtonLink>
				) : null}
			</div>

			{hasRecipients ? (
				<div className="md:border-border md:bg-card md:rounded-[32px] md:border md:shadow-sm">
					<div
						className={cn(
							'border-border text-muted-foreground hidden gap-4 border-b px-8 py-4 text-xs font-semibold tracking-[0.2em] uppercase md:grid',
							gridColumns,
						)}
					>
						<span>Recipient</span>
						<span>Schedule</span>
						<span>Queued</span>
						<span className="sr-only">Actions</span>
					</div>
					<ul className="md:divide-border space-y-3 md:space-y-0 md:divide-y">
						{recipients.map((recipient) => {
							const messageCount = recipient.messageCount
							const messageText = `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`
							const queueEmpty = messageCount === 0
							const scheduleTone = recipient.disabled
								? 'text-muted-foreground'
								: recipient.cronError
									? 'text-foreground-destructive'
									: 'text-foreground'
							return (
								<li
									key={recipient.id}
									className={cn(
										'border-border bg-card hover:border-brand/40 md:hover:bg-muted/40 relative flex flex-col gap-3 rounded-[24px] border px-5 py-4 shadow-sm transition-colors md:grid md:items-center md:gap-4 md:rounded-none md:border-0 md:bg-transparent md:px-8 md:py-5 md:shadow-none',
										gridColumns,
									)}
								>
									<div className="min-w-0">
										<Link
											to={recipient.id}
											prefetch="intent"
											className="text-foreground block truncate text-lg font-semibold after:absolute after:inset-0 after:content-[''] md:text-base"
										>
											{recipient.name}
										</Link>
										<p className="text-muted-foreground truncate text-sm">
											{recipient.phoneNumber}
										</p>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Icon
											name="clock"
											size="sm"
											aria-hidden="true"
											className="text-muted-foreground shrink-0"
										/>
										<span className={cn('font-medium', scheduleTone)}>
											{recipient.scheduleDisplay}
										</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										{queueEmpty ? (
											<span className="bg-warning/15 text-warning-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
												<Icon
													name="exclamation-circle-outline"
													size="xs"
													aria-hidden="true"
												/>
												Nothing queued
											</span>
										) : (
											<>
												<Icon
													name="message"
													size="sm"
													aria-hidden="true"
													className="text-muted-foreground shrink-0"
												/>
												<span className="text-foreground font-medium">
													{messageText}
												</span>
											</>
										)}
									</div>
									<div className="text-muted-foreground hidden items-center justify-end gap-1 text-sm font-semibold md:flex">
										Open
										<Icon name="chevron-right" size="sm" aria-hidden="true" />
									</div>
									<Icon
										name="chevron-right"
										size="sm"
										aria-hidden="true"
										className="text-muted-foreground absolute top-5 right-5 md:hidden"
									/>
								</li>
							)
						})}
					</ul>
				</div>
			) : (
				<div className="border-border bg-card flex flex-col items-center gap-5 rounded-[32px] border px-6 py-16 text-center shadow-sm">
					<span className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
						<Icon name="avatar" size="lg" aria-hidden="true" />
					</span>
					<div className="max-w-sm">
						<p className="text-foreground text-xl font-bold">
							Add your first recipient
						</p>
						<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
							Start with someone you're grateful for. You'll pick a schedule,
							then queue up notes for them to receive.
						</p>
					</div>
					<ButtonLink
						to="new"
						variant="brand"
						className="w-full gap-2 sm:w-auto"
					>
						<Icon name="plus" size="sm" aria-hidden="true" />
						Add recipient
					</ButtonLink>
				</div>
			)}
		</div>
	)
}

function PlanBanner({
	tone,
	message,
	cta,
}: {
	tone: 'trial' | 'upgrade'
	message: string
	cta: string
}) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 rounded-[20px] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between',
				tone === 'trial'
					? 'bg-banner-trial text-banner-trial-foreground'
					: 'bg-banner-upgrade text-banner-upgrade-foreground',
			)}
		>
			<p className="flex items-center gap-2 font-semibold">
				<Icon name="star" size="sm" aria-hidden="true" />
				{message}
			</p>
			<Link
				to="/settings/profile/subscription"
				className="inline-flex items-center gap-1 font-semibold underline underline-offset-4"
			>
				{cta}
				<Icon name="arrow-right" size="xs" aria-hidden="true" />
			</Link>
		</div>
	)
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
