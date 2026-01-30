import { type MetaFunction } from '@remix-run/node'
import { Link } from '@remix-run/react'
import { Button } from '#app/components/ui/button.js'
import { Input } from '#app/components/ui/input.tsx'
import { useOptionalUser } from '#app/utils/user.js'

export const meta: MetaFunction = () => [{ title: 'GratiText' }]

export default function Index() {
	const user = useOptionalUser()
	return (
		<main className="bg-background pb-20 pt-12">
			<section className="container grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
				<div className="space-y-6">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
						GratiText
					</p>
					<h1 className="text-4xl font-bold text-foreground md:text-6xl">
						Thoughtful Connections Made Simple
					</h1>
					<p className="max-w-xl text-body-md text-muted-foreground">
						Strengthen your relationships with regular, personal messages of
						love and gratitude. GratiText keeps you close to the people who
						matter most, without losing the human touch.
					</p>
					<div className="flex flex-wrap gap-4">
						<Button asChild size="lg">
							{user ? (
								<Link to="/recipients">Open dashboard</Link>
							) : (
								<Link to="/login">Get started</Link>
							)}
						</Button>
						<Button asChild variant="secondary" size="lg">
							<Link to="/about">Learn more</Link>
						</Button>
					</div>
					<div className="inline-flex max-w-xs items-center gap-2 rounded-full bg-[hsl(var(--palette-dust-pink))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--palette-chestnut))]">
						You are all kinds of awesome
					</div>
				</div>
				<div className="relative flex justify-center">
					<div className="absolute -left-6 top-8 hidden h-20 w-20 rounded-[28px] bg-[hsl(var(--palette-baby-blue))] lg:block" />
					<div className="absolute -right-4 bottom-10 hidden h-16 w-16 rounded-full bg-[hsl(var(--palette-rose-pink))] lg:block" />
					<div className="max-w-md">
						<img
							src="/images/smiling-phone-flowers.jpg"
							alt="Smiling person holding flowers and a phone"
							className="aspect-square w-full rounded-[40px] border border-border object-cover shadow-lg"
						/>
						<p className="mt-2 text-xs text-muted-secondary-foreground">
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

			<section className="container mt-16">
				<div className="relative overflow-hidden rounded-[48px] bg-[hsl(var(--palette-green-700))] px-6 py-12 text-[hsl(var(--palette-cream))] shadow-sm dark:bg-[hsl(var(--palette-green-900))]">
					<div className="absolute -left-6 -top-6 hidden h-20 w-20 rounded-full bg-[hsl(var(--palette-sunny))] opacity-80 md:block" />
					<div className="absolute -bottom-6 right-10 hidden h-24 w-24 rounded-[32px] bg-[hsl(var(--palette-orange))] opacity-70 md:block" />
					<div className="mx-auto max-w-3xl text-center">
						<p className="text-xs font-semibold uppercase tracking-[0.3em] text-[hsl(var(--palette-green-100))]">
							Messages written by you
						</p>
						<h2 className="mt-3 text-3xl font-bold md:text-4xl">
							Messages written by you... Not by AI.
						</h2>
						<p className="mx-auto mt-4 max-w-2xl text-base text-[hsl(var(--palette-green-100))]">
							Our platform schedules and delivers personal, heartfelt messages on
							your schedule, so you can stay connected without losing your voice.
						</p>
					</div>
				</div>
			</section>

			<section className="container py-16">
				<div className="mx-auto max-w-2xl text-center">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
						How it works
					</p>
					<h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
						How does GratiText work?
					</h2>
					<p className="mt-4 text-body-sm text-muted-foreground">
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
							className="rounded-[28px] border border-border bg-card p-6 shadow-sm"
						>
							<p className="text-3xl font-bold text-[hsl(var(--palette-chestnut))]">
								{String(index + 1).padStart(2, '0')}
							</p>
							<h3 className="mt-2 text-xl font-bold text-foreground">
								{step.title}
							</h3>
							<p className="mt-2 text-body-xs text-muted-foreground">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="bg-muted py-16">
				<div className="container">
					<div className="mx-auto max-w-2xl text-center">
						<p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
							Pricing
						</p>
						<h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
							Affordable pricing plans
						</h2>
						<p className="mt-4 text-body-sm text-muted-foreground">
							Choose a plan that matches how often you want to send messages.
						</p>
					</div>
					<div className="mt-10 grid gap-6 md:grid-cols-2">
						<div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-xl font-bold text-foreground">Basic</h3>
									<p className="text-body-xs text-muted-foreground">
										1 message per day
									</p>
								</div>
								<p className="text-2xl font-bold text-[hsl(var(--palette-cloud))]">
									$4.99
								</p>
							</div>
							<div className="mt-6">
								<Button variant="secondary">Get started</Button>
							</div>
						</div>
						<div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-xl font-bold text-foreground">Premium</h3>
									<p className="text-body-xs text-muted-foreground">
										10 messages per day
									</p>
								</div>
								<p className="text-2xl font-bold text-[hsl(var(--palette-chestnut))]">
									$14.99
								</p>
							</div>
							<div className="mt-6">
								<Button>Get started</Button>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="container py-16">
				<div className="rounded-[32px] bg-[hsl(var(--palette-dust-pink))] px-8 py-12 text-[hsl(var(--palette-chocolate))]">
					<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
						<div className="space-y-3">
							<p className="text-xs font-semibold uppercase tracking-[0.3em] text-[hsl(var(--palette-chestnut))]">
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
						<Button asChild className="bg-[hsl(var(--palette-chestnut))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-hot-fire-red))]">
							<Link to="/login">Get started</Link>
						</Button>
					</div>
					</div>
				</div>
			</section>
		</main>
	)
}
