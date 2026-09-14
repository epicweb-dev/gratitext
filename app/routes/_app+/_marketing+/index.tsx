import { Form, Link, type MetaFunction } from 'react-router'
import { FlowerSticker } from '#app/components/marketing/sticker.tsx'
import { WaveEdge } from '#app/components/marketing/wave.tsx'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.tsx'
import { inputClassName } from '#app/components/ui/input.tsx'
import { cn } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.js'

export const meta: MetaFunction = () => [
	{ title: 'GratiText | Thoughtful Connections Made Simple' },
]

const steps = [
	{
		title: 'Sign Up',
		description:
			'Create an account and start sending thoughtful messages to your loved ones.',
	},
	{
		title: 'Add a Loved One',
		description: 'Add the phone number of your loved one to get started.',
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
		title: 'Message Sent',
		description:
			'Our system sends your messages to your loved ones automatically on the schedule.',
	},
	{
		title: 'Reminders',
		description:
			'We remind you when a loved one has no message waiting, so no send date is missed.',
	},
]

const plans = [
	{
		name: 'Basic',
		summary: '1 message per day',
		dollars: '4',
		cents: '99',
		featured: false,
	},
	{
		name: 'Premium',
		summary: '10 messages per day',
		dollars: '14',
		cents: '99',
		featured: true,
	},
]

const smileys = [
	{
		src: '/images/smiley-pink.png',
		className: 'top-2 left-[14%] w-14 md:top-6 md:left-[22%] md:w-[6.25rem]',
	},
	{
		src: '/images/smiley-lilac.png',
		className: 'top-0 right-[10%] w-11 md:-top-1 md:right-[26%] md:w-20',
	},
	{
		src: '/images/smiley-blue.png',
		className: 'top-12 left-0 w-14 md:top-40 md:left-[9%] md:w-24',
	},
	{
		src: '/images/smiley-orange.png',
		className: 'top-2 right-0 w-14 md:top-32 md:right-[7%] md:w-24',
	},
]

export default function Index() {
	const user = useOptionalUser()
	const getStartedTo = user ? '/recipients' : '/signup'
	const planTo = user ? '/settings/profile/subscription' : '/signup'
	return (
		<main className="overflow-x-clip">
			<section
				aria-labelledby="hero-heading"
				className="bg-hero relative pt-6 pb-24 md:pt-20 md:pb-36"
			>
				<div className="container grid items-center gap-8 md:grid-cols-[1fr_1.05fr] md:gap-12">
					<div className="order-2 text-center md:order-1 md:text-left">
						<h1
							id="hero-heading"
							className="font-display text-foreground md:text-h1 text-[2.625rem] leading-[1.08]"
						>
							Thoughtful
							<br />
							Connections
							<br />
							Made Simple
						</h1>
						<p className="text-muted-foreground mx-auto mt-5 max-w-md text-base leading-relaxed md:mx-0 md:mt-6 md:max-w-sm md:text-[0.9375rem]">
							Strengthen your relationships with regular personalized messages
							of love and gratitude.
						</p>
						<Button
							asChild
							variant="warm"
							size="lg"
							className="mt-7 w-full md:mt-8 md:w-auto md:px-9"
						>
							<Link to={getStartedTo}>
								<span className="md:hidden">Start 14-day FREE trial</span>
								<span className="hidden md:inline">Get started</span>
							</Link>
						</Button>
					</div>
					<div className="order-1 flex justify-center md:order-2 md:justify-end">
						<img
							src="/images/hero-illustration.webp"
							alt="Smiling woman holding a bouquet while reading a text, surrounded by stars, a tulip and a heart"
							width={1254}
							height={1234}
							fetchPriority="high"
							className="w-full max-w-[19rem] md:max-w-[36rem]"
						/>
					</div>
				</div>
			</section>

			<section
				aria-labelledby="own-words-heading"
				className="bg-feature text-feature-foreground relative mt-6 pt-20 pb-32 md:mt-10 md:pt-28 md:pb-40"
			>
				<WaveEdge edge="top" className="text-feature" />
				<WaveEdge edge="bottom" className="text-feature" />
				<FlowerSticker
					lobes={7}
					rotate={-12}
					className="absolute -bottom-14 left-[2%] z-10 w-[11.5rem] md:-top-24 md:bottom-auto md:left-[13%] md:w-[15rem]"
					shapeClassName="fill-palette-cream drop-shadow-[0_6px_12px_rgba(24,36,48,0.06)]"
				>
					<span className="text-palette-green-500 text-[1.35rem] md:text-[1.75rem]">
						you are all
					</span>
					<span className="text-palette-blues text-[1.35rem] md:text-[1.75rem]">
						kinds of
					</span>
					<span className="text-palette-rose-pink text-[1.35rem] md:text-[1.75rem]">
						awesome
					</span>
				</FlowerSticker>
				<FlowerSticker
					lobes={6}
					rotate={-8}
					className="absolute right-[3%] -bottom-24 z-10 w-[10rem] md:right-[11%] md:-bottom-24 md:w-[14rem]"
					shapeClassName="fill-palette-dust-pink dark:fill-palette-chestnut"
				>
					<span className="text-palette-chestnut dark:text-palette-dust-pink text-[1.35rem] md:text-[2.1rem]">
						create
						<br />
						smiles
					</span>
				</FlowerSticker>
				<div className="relative container text-center">
					<h2
						id="own-words-heading"
						className="font-display md:text-h2 mx-auto max-w-2xl text-[2rem] leading-[1.15]"
					>
						Messages written
						<br />
						by you… Not by AI.
					</h2>
					<p className="mx-auto mt-6 max-w-md text-base leading-relaxed md:max-w-lg md:text-[0.9375rem]">
						Our platform schedules and delivers personal heartfelt messages from
						you, making it easy to stay connected and nurture your most
						important relationships.
					</p>
				</div>
			</section>

			<section
				id="how-it-works"
				aria-labelledby="how-it-works-heading"
				className="bg-background relative scroll-mt-24 pt-28 pb-28 md:pt-40 md:pb-44"
			>
				<div className="relative container">
					<img
						src="/images/paper-plane.png"
						alt=""
						width={397}
						height={184}
						className="pointer-events-none absolute top-24 right-0 hidden w-[15rem] lg:block"
					/>
					<svg
						aria-hidden="true"
						viewBox="0 0 1200 760"
						fill="none"
						className="text-palette-beige dark:text-muted pointer-events-none absolute top-40 -left-[10%] hidden w-[120%] lg:block"
					>
						<path
							d="M1085 30C990 150 900 240 790 300C680 360 620 440 660 510C700 580 780 520 740 440C700 360 560 380 480 480C400 580 300 700 60 745"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeDasharray="12 10"
							strokeLinecap="round"
						/>
					</svg>
					<div className="relative mx-auto max-w-2xl text-center">
						<h2
							id="how-it-works-heading"
							className="font-display text-foreground md:text-h2 text-[2rem] leading-[1.15]"
						>
							How does
							<br />
							gratitext work?
						</h2>
						<p className="text-muted-foreground mx-auto mt-5 max-w-xs text-base leading-relaxed md:max-w-lg md:text-[0.9375rem]">
							Whether it's a simple thank you or a meaningful reminder of your
							affection, GratiText helps you make a lasting impact on the people
							you care about.
						</p>
					</div>
					<ol className="relative mt-16 grid gap-14 md:mt-28 md:grid-cols-3 md:gap-x-10 md:gap-y-20">
						{steps.map((step, index) => (
							<li
								key={step.title}
								className={cn(
									'mx-auto flex max-w-[17rem] flex-col items-center text-center',
									index % 3 === 1 && 'md:-mt-24',
								)}
							>
								<span className="font-display text-accent text-[2.75rem] leading-none md:text-[3.25rem]">
									{String(index + 1).padStart(2, '0')}
								</span>
								<h3 className="font-display text-foreground mt-4 text-[1.375rem] leading-[1.15] md:text-[1.75rem]">
									{step.title}
								</h3>
								<p className="text-muted-foreground mt-2.5 text-[0.9375rem] leading-relaxed md:text-sm">
									{step.description}
								</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section
				id="pricing"
				aria-labelledby="pricing-heading"
				className="bg-pricing relative scroll-mt-24 pt-14 pb-16 md:pt-24 md:pb-24"
			>
				<WaveEdge edge="top" className="text-pricing" />
				<div className="container">
					<div className="relative mx-auto max-w-4xl">
						{smileys.map((smiley) => (
							<img
								key={smiley.src}
								src={smiley.src}
								alt=""
								className={cn(
									'pointer-events-none absolute select-none',
									smiley.className,
								)}
							/>
						))}
						<div className="relative mx-auto max-w-xl pt-8 text-center md:pt-4">
							<h2
								id="pricing-heading"
								className="font-display text-foreground md:text-h2 text-[2rem] leading-[1.15]"
							>
								Affordable
								<br />
								pricing plans
							</h2>
							<p className="text-muted-foreground mx-auto mt-5 max-w-xs text-base leading-relaxed md:max-w-lg md:text-[0.9375rem]">
								Whether it's a simple thank you or a meaningful reminder of your
								affection, GratiText helps you make a lasting impact on the
								people you care about.
							</p>
						</div>
					</div>
					<ul className="mx-auto mt-10 grid max-w-[68rem] gap-4 md:mt-16 md:gap-3">
						{plans.map((plan) => (
							<li
								key={plan.name}
								className={cn(
									'grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-5 md:grid-cols-[1fr_1.3fr_0.9fr_auto] md:items-center md:gap-6 md:px-12 md:py-6',
									plan.featured
										? 'bg-card text-card-foreground rounded-[1.75rem] shadow-[0_18px_40px_-24px_rgba(24,36,48,0.25)] md:rounded-[2rem]'
										: 'text-foreground',
								)}
							>
								<h3 className="font-display text-[1.375rem] leading-none md:text-[1.625rem]">
									{plan.name}
								</h3>
								<p
									className={cn(
										'col-start-1 row-start-2 text-sm md:col-start-2 md:row-start-1 md:text-[0.9375rem]',
										plan.featured ? 'text-card-foreground' : 'text-foreground',
									)}
								>
									{plan.summary}
								</p>
								<p className="col-start-2 row-start-1 flex items-start justify-end leading-none md:col-start-3 md:justify-start">
									<span className="font-display text-base md:text-lg">$</span>
									<span className="font-display text-[1.75rem] md:text-[2.25rem]">
										{plan.dollars}
									</span>
									<span className="font-display ml-0.5 text-sm md:text-base">
										{plan.cents}
									</span>
								</p>
								<Button
									asChild
									variant={plan.featured ? 'brand' : 'outline'}
									className="col-span-2 mt-2 w-full md:col-span-1 md:col-start-4 md:mt-0 md:w-auto md:px-8"
								>
									<Link to={planTo}>Get started</Link>
								</Button>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section
				aria-labelledby="cta-heading"
				className="bg-pricing pb-14 md:pb-16"
			>
				<div className="container">
					<div className="bg-cta text-cta-foreground relative isolate overflow-hidden rounded-[1.75rem] px-6 py-24 md:min-h-[30rem] md:rounded-[2rem] md:px-12 md:py-28">
						<img
							src="/images/cta-sun.png"
							alt=""
							className="pointer-events-none absolute top-0 -left-6 w-[9.5rem] md:left-[5%] md:w-[13rem]"
						/>
						<img
							src="/images/cta-flower.png"
							alt=""
							className="pointer-events-none absolute right-[4%] -bottom-14 w-[10rem] md:top-[8%] md:right-[3%] md:bottom-auto md:w-[14.5rem]"
						/>
						<img
							src="/images/cta-heart.png"
							alt=""
							className="pointer-events-none absolute -bottom-4 -left-6 w-[8rem] md:bottom-0 md:left-[3%] md:w-[13rem]"
						/>
						<img
							src="/images/cta-leaves.png"
							alt=""
							className="pointer-events-none absolute right-0 -bottom-6 hidden w-[15rem] md:block md:w-[27rem]"
						/>
						<div className="relative mx-auto max-w-2xl text-center">
							<h2
								id="cta-heading"
								className="font-display text-[1.875rem] leading-[1.15] md:text-[2.25rem]"
							>
								Create your account today and
								<br className="hidden md:block" /> get 2 weeks for free!
							</h2>
							<Form
								method="GET"
								action="/signup"
								className="relative mx-auto mt-8 max-w-[26rem]"
							>
								<label htmlFor="cta-phone" className="sr-only">
									Your Phone Number
								</label>
								<input
									id="cta-phone"
									name="phoneNumber"
									type="tel"
									autoComplete="tel"
									placeholder="Your Phone Number"
									className={cn(
										inputClassName,
										'bg-inverse text-foreground dark:bg-card h-14 border-transparent pr-16 md:h-[3.75rem] md:pr-36',
									)}
								/>
								<Button
									type="submit"
									variant="brand"
									className="absolute top-1/2 right-2 h-10 w-10 -translate-y-1/2 px-0 md:h-11 md:w-auto md:px-6"
								>
									<span className="hidden md:inline">Get Started</span>
									<Icon
										name="arrow-right"
										size="sm"
										aria-hidden="true"
										className="md:hidden"
									/>
									<span className="sr-only md:hidden">Get Started</span>
								</Button>
							</Form>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
