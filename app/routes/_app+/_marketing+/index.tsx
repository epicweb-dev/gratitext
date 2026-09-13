import { Link, type MetaFunction } from 'react-router'
import { Button } from '#app/components/ui/button.js'
import { Icon, type IconName } from '#app/components/ui/icon.tsx'
import { useOptionalUser } from '#app/utils/user.js'

export const meta: MetaFunction = () => [
	{ title: 'GratiText | Thoughtful gratitude texts, on your schedule' },
]

const steps: Array<{ title: string; description: string; icon: IconName }> = [
	{
		title: 'Create your account',
		description:
			'Sign up with your phone number. Your first 14 days are free, no credit card needed.',
		icon: 'avatar',
	},
	{
		title: 'Add a loved one',
		description:
			'Enter the name and phone number of someone you want to stay close to.',
		icon: 'phone',
	},
	{
		title: 'Pick a schedule',
		description:
			'Choose the day and time your notes should arrive, in their time zone.',
		icon: 'clock',
	},
	{
		title: 'Write in your own words',
		description:
			'Queue up personal notes of thanks whenever inspiration strikes.',
		icon: 'pencil-1',
	},
	{
		title: 'We deliver on time',
		description:
			'Each note is texted automatically at the moment you scheduled it.',
		icon: 'send',
	},
	{
		title: 'Never run dry',
		description:
			'We remind you when a recipient has no message waiting, so no send date is missed.',
		icon: 'exclamation-circle-outline',
	},
]

const plans = [
	{
		name: 'Basic',
		price: '$4.99',
		cadence: 'per month',
		summary: 'One heartfelt note a day.',
		features: [
			'1 message per day',
			'As many recipients as you like',
			'Reminders when a queue runs empty',
		],
		priceClassName: 'text-price-basic',
		variant: 'secondary' as const,
	},
	{
		name: 'Premium',
		price: '$14.99',
		cadence: 'per month',
		summary: 'Room for the whole family and your closest friends.',
		features: [
			'Up to 10 messages per day',
			'As many recipients as you like',
			'Reminders when a queue runs empty',
		],
		priceClassName: 'text-price-premium',
		variant: 'default' as const,
		highlighted: true,
	},
]

export default function Index() {
	const user = useOptionalUser()
	const primaryCta = user
		? { to: '/recipients', label: 'Open your recipients' }
		: { to: '/signup', label: 'Start your 14-day free trial' }
	const planCta = user ? '/settings/profile/subscription' : '/signup'
	return (
		<main className="bg-background pt-8 pb-20 md:pt-14">
			<section className="container grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
				<div className="order-2 space-y-6 text-center lg:order-1 lg:text-left">
					<p className="text-brand text-xs font-semibold tracking-[0.3em] uppercase">
						Gratitude, delivered by text
					</p>
					<h1 className="text-foreground font-serif text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl lg:text-6xl">
						Thoughtful connections, made simple
					</h1>
					<p className="text-muted-foreground mx-auto max-w-xl text-lg leading-relaxed text-pretty lg:mx-0">
						Write heartfelt notes to the people you love and GratiText texts
						them on the schedule you choose. Your words, in your voice, arriving
						right on time.
					</p>
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
						<Button
							asChild
							size="lg"
							variant="warm"
							className="w-full sm:w-auto"
						>
							<Link to={primaryCta.to}>{primaryCta.label}</Link>
						</Button>
						<Button
							asChild
							size="lg"
							variant="ghost"
							className="w-full sm:w-auto"
						>
							<a href="#how-it-works">
								See how it works
								<Icon name="arrow-right" size="sm" aria-hidden="true" />
							</a>
						</Button>
					</div>
					{user ? null : (
						<p className="text-muted-foreground text-sm">
							No credit card required. Cancel anytime.
						</p>
					)}
				</div>
				<div className="order-1 flex justify-center lg:order-2">
					<div className="relative w-full max-w-xs sm:max-w-sm">
						<div className="bg-hero-orb absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[320px] sm:w-[320px]" />
						<Icon
							name="star"
							size="lg"
							aria-hidden="true"
							className="text-hero-sparkle absolute top-2 left-2"
						/>
						<Icon
							name="star"
							size="md"
							aria-hidden="true"
							className="text-hero-sparkle absolute top-16 left-12"
						/>
						<div className="bg-hero-sparkle absolute top-24 left-4 h-6 w-10 rounded-full" />
						<div className="bg-hero-sparkle absolute bottom-6 left-6 h-12 w-12 rounded-[22px]" />
						<div className="bg-brand text-brand-foreground absolute top-1/2 -right-2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-lg">
							<Icon name="message" size="sm" aria-hidden="true" />
						</div>
						<img
							src="/images/smiling-phone-flowers.jpg"
							alt="Smiling person holding flowers and reading a text message"
							width={2560}
							height={2560}
							fetchPriority="high"
							className="relative z-10 aspect-square w-full rounded-[36px] object-cover shadow-lg"
						/>
						<p className="text-muted-secondary-foreground mt-3 text-center text-xs">
							Photo by{' '}
							<a
								className="underline"
								href="https://unsplash.com/@goodfacesagency?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
							>
								Good Faces
							</a>{' '}
							on{' '}
							<a
								className="underline"
								href="https://unsplash.com/photos/a-woman-walking-down-the-street-looking-at-her-cell-phone-58xYWBSr0aQ?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
							>
								Unsplash
							</a>
						</p>
					</div>
				</div>
			</section>

			<section className="container mt-16 md:mt-24" aria-labelledby="own-words">
				<div className="bg-marketing-feature text-marketing-feature-foreground relative overflow-hidden rounded-[40px] px-6 py-12 shadow-sm md:px-12 md:py-16">
					<div className="bg-marketing-feature-accent absolute -top-6 -left-6 hidden h-20 w-20 rounded-full opacity-80 md:block" />
					<div className="bg-marketing-feature-accent-secondary absolute right-10 -bottom-6 hidden h-24 w-24 rounded-[32px] opacity-70 md:block" />
					<div className="mx-auto max-w-3xl text-center">
						<p className="text-marketing-feature-muted text-xs font-semibold tracking-[0.3em] uppercase">
							Your voice, not a robot's
						</p>
						<h2
							id="own-words"
							className="mt-3 font-serif text-3xl font-semibold text-balance md:text-4xl"
						>
							Every message is written by you. Never by AI.
						</h2>
						<p className="text-marketing-feature-muted mx-auto mt-4 max-w-2xl text-base leading-relaxed text-pretty md:text-lg">
							GratiText handles the scheduling and delivery so you can stay
							connected without losing what makes your notes special: they come
							from you.
						</p>
					</div>
				</div>
			</section>

			<section
				id="how-it-works"
				className="container scroll-mt-24 py-16 md:py-24"
				aria-labelledby="how-it-works-heading"
			>
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
						How it works
					</p>
					<h2
						id="how-it-works-heading"
						className="text-foreground mt-3 font-serif text-3xl font-semibold text-balance md:text-4xl"
					>
						Six small steps to a lasting habit
					</h2>
					<p className="text-muted-foreground mt-4 text-base text-pretty">
						Whether it is a simple thank you or a meaningful reminder of your
						affection, GratiText helps you make a lasting impact on the people
						you care about.
					</p>
				</div>
				<ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{steps.map((step, index) => (
						<li
							key={step.title}
							className="border-border bg-card flex flex-col gap-4 rounded-[28px] border p-6 shadow-sm"
						>
							<div className="flex items-center justify-between">
								<span className="bg-accent text-accent-foreground flex h-11 w-11 items-center justify-center rounded-2xl">
									<Icon name={step.icon} size="md" aria-hidden="true" />
								</span>
								<span className="text-marketing-step-index font-serif text-2xl font-semibold">
									{String(index + 1).padStart(2, '0')}
								</span>
							</div>
							<div>
								<h3 className="text-foreground text-lg font-bold">
									{step.title}
								</h3>
								<p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
									{step.description}
								</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section
				id="pricing"
				className="bg-muted scroll-mt-24 py-16 md:py-24"
				aria-labelledby="pricing-heading"
			>
				<div className="container">
					<div className="mx-auto max-w-2xl text-center">
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
							Pricing
						</p>
						<h2
							id="pricing-heading"
							className="text-foreground mt-3 font-serif text-3xl font-semibold text-balance md:text-4xl"
						>
							Simple plans, 14 days free
						</h2>
						<p className="text-muted-foreground mt-4 text-base text-pretty">
							Pick the plan that matches how many people you want to reach.
							Every plan starts with a free two-week trial.
						</p>
					</div>
					<div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
						{plans.map((plan) => (
							<div
								key={plan.name}
								className={
									plan.highlighted
										? 'border-brand bg-card relative flex flex-col rounded-[28px] border-2 p-6 shadow-md md:p-8'
										: 'border-border bg-card flex flex-col rounded-[28px] border p-6 shadow-sm md:p-8'
								}
							>
								{plan.highlighted ? (
									<span className="bg-brand text-brand-foreground absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
										Most popular
									</span>
								) : null}
								<div className="flex items-start justify-between gap-4">
									<div>
										<h3 className="text-foreground text-xl font-bold">
											{plan.name}
										</h3>
										<p className="text-muted-foreground mt-1 text-sm">
											{plan.summary}
										</p>
									</div>
									<div className="text-right">
										<p
											className={`${plan.priceClassName} text-3xl font-bold tracking-tight`}
										>
											{plan.price}
										</p>
										<p className="text-muted-foreground text-xs">
											{plan.cadence}
										</p>
									</div>
								</div>
								<ul className="mt-6 space-y-2.5">
									{plan.features.map((feature) => (
										<li
											key={feature}
											className="text-foreground flex items-center gap-2.5 text-sm"
										>
											<span className="bg-accent text-accent-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
												<Icon name="check" size="xs" aria-hidden="true" />
											</span>
											{feature}
										</li>
									))}
								</ul>
								<div className="mt-8">
									<Button asChild variant={plan.variant} className="w-full">
										<Link to={planCta}>
											{user ? `Choose ${plan.name}` : 'Start free trial'}
										</Link>
									</Button>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			<section
				className="container py-16 md:py-24"
				aria-labelledby="cta-heading"
			>
				<div className="bg-marketing-cta text-marketing-cta-foreground rounded-[32px] px-6 py-12 md:px-12">
					<div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
						<div className="max-w-2xl space-y-3">
							<p className="text-marketing-cta-accent text-xs font-semibold tracking-[0.3em] uppercase">
								Ready when you are
							</p>
							<h2
								id="cta-heading"
								className="font-serif text-3xl font-semibold text-balance md:text-4xl"
							>
								Send your first note of thanks today.
							</h2>
							<p className="text-marketing-cta-accent text-base">
								Your first 14 days are on us. No credit card required.
							</p>
						</div>
						<Button asChild size="lg" variant="warm" className="shrink-0">
							<Link to={primaryCta.to}>{primaryCta.label}</Link>
						</Button>
					</div>
				</div>
			</section>
		</main>
	)
}
