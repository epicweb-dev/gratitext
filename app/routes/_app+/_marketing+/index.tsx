import { Link, type MetaFunction } from 'react-router'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.tsx'
import { useOptionalUser } from '#app/utils/user.js'

export const meta: MetaFunction = () => [{ title: 'GratiText' }]

export default function Index() {
	const user = useOptionalUser()
	return (
		<main className="bg-background pt-6 pb-20 md:pt-10">
			<section className="container grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
				<div className="order-1 flex justify-center lg:order-2">
					<div className="relative w-full max-w-xs sm:max-w-sm">
						<div className="absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--palette-baby-blue))] sm:h-[320px] sm:w-[320px]" />
						<Icon
							name="star"
							size="lg"
							aria-hidden="true"
							className="absolute top-2 left-2 text-[hsl(var(--palette-orange))]"
						/>
						<Icon
							name="star"
							size="md"
							aria-hidden="true"
							className="absolute top-16 left-12 text-[hsl(var(--palette-orange))]"
						/>
						<div className="absolute top-24 left-4 h-6 w-10 rounded-full bg-[hsl(var(--palette-orange))]" />
						<div className="absolute bottom-6 left-6 h-12 w-12 rounded-[22px] bg-[hsl(var(--palette-orange))]" />
						<div className="absolute top-1/2 -right-2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[hsl(var(--palette-green-500))] text-[hsl(var(--palette-cream))] shadow-lg">
							<Icon name="message" size="sm" aria-hidden="true" />
						</div>
						<img
							src="/images/smiling-phone-flowers.jpg"
							alt="Smiling person holding flowers and a phone"
							width={2560}
							height={2560}
							className="relative z-10 aspect-square w-full rounded-[36px] object-cover shadow-lg"
						/>
						<p className="text-muted-secondary-foreground mt-3 hidden text-center text-xs md:block">
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
				<div className="order-2 space-y-5 text-center lg:order-1 lg:text-left">
					<h1 className="text-foreground font-serif text-4xl leading-tight font-semibold md:text-5xl lg:text-6xl">
						Thoughtful Connections Made Simple
					</h1>
					<p className="text-body-md text-muted-foreground mx-auto max-w-xl lg:mx-0">
						Strengthen your relationships with regular personalized messages of
						love and gratitude.
					</p>
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
						<Button
							asChild
							size="lg"
							variant="warm"
							className="w-full max-w-[320px] sm:w-auto"
						>
							{user ? (
								<Link to="/recipients">Open dashboard</Link>
							) : (
								<Link to="/login">Start 14-day FREE trial</Link>
							)}
						</Button>
					</div>
				</div>
			</section>

			<section className="container mt-16">
				<div className="relative overflow-hidden rounded-[48px] bg-[hsl(var(--palette-green-700))] px-6 py-12 text-[hsl(var(--palette-cream))] shadow-sm dark:bg-[hsl(var(--palette-green-900))]">
					<div className="absolute -top-6 -left-6 hidden h-20 w-20 rounded-full bg-[hsl(var(--palette-sunny))] opacity-80 md:block" />
					<div className="absolute right-10 -bottom-6 hidden h-24 w-24 rounded-[32px] bg-[hsl(var(--palette-orange))] opacity-70 md:block" />
					<div className="mx-auto max-w-3xl text-center">
						<p className="text-xs font-semibold tracking-[0.3em] text-[hsl(var(--palette-green-100))] uppercase">
							Messages written by you
						</p>
						<h2 className="mt-3 text-3xl font-bold md:text-4xl">
							Messages written by you... Not by AI.
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-base text-[hsl(var(--palette-green-100))]">
							Our platform schedules and delivers personal, heartfelt messages
							on your schedule, so you can stay connected without losing your
							voice.
						</p>
					</div>
				</div>
			</section>

			<section className="container py-16">
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
						How it works
					</p>
					<h2 className="text-foreground mt-3 text-3xl font-bold md:text-4xl">
						How does GratiText work?
					</h2>
					<p className="text-body-sm text-muted-foreground mt-4">
						Whether it's a simple thank you or a meaningful reminder of your
						affection, GratiText helps you make a lasting impact on the people
						you care about.
					</p>
				</div>
				<div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{[
						{
							title: 'Sign Up',
							description:
								'Create an account and start sending thoughtful messages to your loved ones.',
						},
						{
							title: 'Add a Loved One',
							description:
								'Add the phone number of your loved one to get started.',
						},
						{
							title: 'Select a Schedule',
							description: 'Choose how often you want to send messages.',
						},
						{
							title: 'Write a Personal Message',
							description:
								'Craft meaningful messages that will be sent to your loved ones.',
						},
						{
							title: 'Messages Sent',
							description:
								'Our system sends your messages automatically on the schedule.',
						},
						{
							title: 'Reminders',
							description:
								'Get notified if you have not yet queued up a message for delivery.',
						},
					].map((step, index) => (
						<div
							key={step.title}
							className="border-border bg-card rounded-[28px] border p-6 shadow-sm"
						>
							<p className="text-3xl font-bold text-[hsl(var(--palette-chestnut))]">
								{String(index + 1).padStart(2, '0')}
							</p>
							<h3 className="text-foreground mt-2 text-xl font-bold">
								{step.title}
							</h3>
							<p className="text-body-xs text-muted-foreground mt-2">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="bg-muted py-16">
				<div className="container">
					<div className="mx-auto max-w-2xl text-center">
						<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
							Pricing
						</p>
						<h2 className="text-foreground mt-3 text-3xl font-bold md:text-4xl">
							Affordable pricing plans
						</h2>
						<p className="text-body-sm text-muted-foreground mt-4">
							Choose a plan that matches how often you want to send messages.
						</p>
					</div>
					<div className="mt-10 grid gap-6 md:grid-cols-2">
						<div className="border-border bg-card rounded-[28px] border p-6 shadow-sm">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-foreground text-xl font-bold">Basic</h3>
									<p className="text-body-xs text-muted-foreground">
										1 message per day
									</p>
								</div>
								<p className="text-2xl font-bold text-[hsl(var(--palette-cloud))]">
									$4.99
								</p>
							</div>
							<div className="mt-6">
								<Button asChild variant="secondary">
									<Link to="/login">Get started</Link>
								</Button>
							</div>
						</div>
						<div className="border-border bg-card rounded-[28px] border p-6 shadow-sm">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-foreground text-xl font-bold">Premium</h3>
									<p className="text-body-xs text-muted-foreground">
										10 messages per day
									</p>
								</div>
								<p className="text-2xl font-bold text-[hsl(var(--palette-chestnut))]">
									$14.99
								</p>
							</div>
							<div className="mt-6">
								<Button asChild>
									<Link to="/login">Get started</Link>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="container py-16">
				<div className="rounded-[32px] bg-[hsl(var(--palette-dust-pink))] px-8 py-12 text-[hsl(var(--palette-chocolate))]">
					<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
						<div className="space-y-3">
							<p className="text-xs font-semibold tracking-[0.3em] text-[hsl(var(--palette-chestnut))] uppercase">
								Ready to start
							</p>
							<h2 className="text-3xl font-bold md:text-4xl">
								Create your account today and get 2 weeks for free.
							</h2>
							<p className="text-body-sm text-[hsl(var(--palette-chestnut))]">
								No credit card required to get started.
							</p>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								asChild
								variant="warm"
							>
								<Link to="/login">Get started</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
