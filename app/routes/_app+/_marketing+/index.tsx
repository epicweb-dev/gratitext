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

export const handle = { footerTint: 'pricing' }

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

/**
 * Paper plane and its dashed flight path, traced from the design at 1440px.
 * Coordinates are relative to the "How it works" container: x from the
 * container's left padding edge, y from the top of the heading. The path
 * starts at the plane's tail so the two always meet.
 */
const PLANE = { x: 1009, y: 136, width: 117, height: 93 }
const TRAIL_PATH =
	'M1049 204C1045 203 1040 198 1025 200C1011 202 982 209 962 216C942 223 921 230 904 242C887 254 870 271 862 289C855 308 854 333 859 353C864 373 878 401 893 408C908 415 941 410 950 397C959 385 956 352 948 333C940 315 921 298 904 286C887 274 865 266 844 260C824 254 803 250 781 249C760 248 736 250 715 254C694 258 673 264 653 273C633 282 614 293 597 306C580 319 564 334 549 350C534 366 520 383 508 402C496 421 486 441 477 462C468 483 461 505 455 527C449 549 446 571 442 593C438 615 437 639 432 661C428 683 423 706 415 727C407 748 399 768 386 786C374 804 358 822 340 835C323 848 303 859 281 865C260 871 229 871 211 870C193 870 189 868 172 862C155 856 131 846 111 836C92 826 74 812 55 800C37 788 19 776 0 765C-19 754 -41 741 -57 733C-73 725 -91 720 -98 717'
// The drawing spans from 120px left of the container to its right edge.
const TRAIL_VIEWBOX = { x: -120, y: 100, width: 1336, height: 800 }

const smileys = [
	{
		src: '/images/smiley-pink.png',
		className:
			'-top-8 left-[20%] w-14 md:-top-[6.25rem] md:left-[12.5%] md:w-[5.25rem]',
	},
	{
		src: '/images/smiley-lilac.png',
		className:
			'-top-12 right-[32%] w-11 md:-top-[7.5rem] md:right-[15.5%] md:w-20',
	},
	{
		src: '/images/smiley-blue.png',
		className: 'top-7 -left-3 w-14 md:top-[7.5rem] md:-left-5 md:w-20',
	},
	{
		src: '/images/smiley-orange.png',
		className: '-top-2 right-0 w-14 md:top-16 md:-right-8 md:w-[5.25rem]',
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
				className="bg-hero relative pt-6 pb-28 md:pt-20 md:pb-32"
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
						<p className="text-muted-foreground mx-auto mt-5 max-w-md text-base leading-relaxed md:mx-0 md:mt-6 md:max-w-[30rem] md:text-[1.0625rem] md:leading-[1.65]">
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
				className="bg-feature text-feature-foreground relative pt-20 pb-44 md:pt-36 md:pb-32"
			>
				<WaveEdge edge="top" className="text-feature" />
				{/* The phone design ends the green band with a straight edge. */}
				<WaveEdge edge="bottom" className="text-feature max-md:hidden" />
				{/* Both stickers sit centred on the wave lines in the design. */}
				<FlowerSticker
					lobes={7}
					rotate={-12}
					className="absolute -bottom-14 left-[2%] z-10 w-[12rem] md:-top-[8.5rem] md:bottom-auto md:left-[13%] md:w-[14.5rem]"
					shapeClassName="fill-palette-cream drop-shadow-[0_6px_12px_rgba(24,36,48,0.06)]"
				>
					<span className="text-palette-green-500 text-[1.75rem] md:text-[2.125rem]">
						you are all
					</span>
					<span className="text-palette-blues text-[1.75rem] md:text-[2.125rem]">
						kinds of
					</span>
					<span className="text-palette-rose-pink text-[1.75rem] md:text-[2.125rem]">
						awesome
					</span>
				</FlowerSticker>
				<FlowerSticker
					lobes={6}
					rotate={-8}
					className="absolute right-[3%] -bottom-24 z-10 w-[10.5rem] md:right-[11%] md:-bottom-[6.25rem] md:w-[15rem]"
					shapeClassName="fill-palette-dust-pink dark:fill-palette-chestnut"
				>
					<span className="text-palette-chestnut dark:text-palette-dust-pink text-[1.75rem] md:text-[2.25rem]">
						create
						<br />
						smiles
					</span>
				</FlowerSticker>
				<div className="relative container text-center">
					<h2
						id="own-words-heading"
						className="font-display mx-auto max-w-2xl text-[2rem] leading-[1.15] md:text-[3rem]"
					>
						Messages written
						<br />
						by you… Not by AI.
					</h2>
					<p className="mx-auto mt-6 max-w-md text-base leading-relaxed md:max-w-lg md:text-[1.0625rem] md:leading-[1.65]">
						Our platform schedules and delivers personal heartfelt messages from
						you, making it easy to stay connected and nurture your most
						important relationships.
					</p>
				</div>
			</section>

			<section
				id="how-it-works"
				aria-labelledby="how-it-works-heading"
				className="bg-background relative scroll-mt-24 pt-[8.5rem] pb-28 lg:pb-24"
			>
				<div className="relative container">
					<svg
						aria-hidden="true"
						viewBox={`${TRAIL_VIEWBOX.x} ${TRAIL_VIEWBOX.y} ${TRAIL_VIEWBOX.width} ${TRAIL_VIEWBOX.height}`}
						preserveAspectRatio="xMinYMin meet"
						fill="none"
						className="text-palette-beige dark:text-muted pointer-events-none absolute top-[100px] left-[-120px] hidden w-[calc(100%+120px)] lg:block"
					>
						<path
							d={TRAIL_PATH}
							stroke="currentColor"
							strokeWidth="2.5"
							strokeDasharray="11 10"
							strokeLinecap="round"
						/>
						<image
							href="/images/paper-plane.png"
							x={PLANE.x}
							y={PLANE.y}
							width={PLANE.width}
							height={PLANE.height}
						/>
					</svg>
					<div className="relative mx-auto max-w-2xl text-center">
						<h2
							id="how-it-works-heading"
							className="font-display text-foreground text-[2.5rem] leading-[1.15] md:text-[3rem]"
						>
							How does
							<br />
							gratitext work?
						</h2>
						<p className="text-muted-foreground mx-auto mt-5 max-w-xs text-base leading-relaxed md:mt-4 md:max-w-[35rem] md:text-[1.0625rem] md:leading-[1.65]">
							Whether it's a simple thank you or a meaningful reminder of your
							affection, GratiText helps you make a lasting impact on the people
							you care about.
						</p>
					</div>
					{/* The design leaves room above the steps for the plane's loop. */}
					<ol className="relative mt-16 grid gap-14 md:mt-24 md:grid-cols-3 md:gap-x-10 md:gap-y-28 lg:mt-[16.5rem]">
						{steps.map((step, index) => (
							<li
								key={step.title}
								className={cn(
									'mx-auto flex max-w-[21rem] flex-col items-center text-center md:max-w-[20.5rem]',
									index % 3 === 1 && 'md:-mt-[7.75rem]',
								)}
							>
								<span className="font-display text-accent text-[2.5rem] leading-none md:text-[4rem] lg:text-[5rem]">
									{String(index + 1).padStart(2, '0')}
								</span>
								<h3 className="font-display text-foreground mt-4 text-[1.5rem] leading-[1.15] md:mt-7 md:text-[2.25rem] lg:text-[2.625rem]">
									{step.title}
								</h3>
								<p className="text-muted-foreground mt-2.5 text-base leading-relaxed md:mt-2 md:text-[1.0625rem] md:leading-[1.6]">
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
				className="bg-pricing relative scroll-mt-24 pt-14 pb-16 md:pt-40 md:pb-24 lg:pt-44"
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
						<div className="relative mx-auto max-w-xl pt-12 text-center md:pt-4">
							<h2
								id="pricing-heading"
								className="font-display text-foreground text-[2.5rem] leading-[1.15] md:text-[3rem]"
							>
								Affordable
								<br />
								pricing plans
							</h2>
							<p className="text-muted-foreground mx-auto mt-5 max-w-xs text-base leading-relaxed md:max-w-[35rem] md:text-[1.0625rem] md:leading-[1.65]">
								Whether it's a simple thank you or a meaningful reminder of your
								affection, GratiText helps you make a lasting impact on the
								people you care about.
							</p>
						</div>
					</div>
					<ul className="mx-auto mt-10 grid max-w-[58rem] gap-4 md:mt-16 md:gap-3">
						{plans.map((plan) => (
							<li
								key={plan.name}
								className={cn(
									'grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-5 md:grid-cols-[1fr_1.3fr_0.9fr_auto] md:items-center md:gap-6 md:px-12 md:py-7',
									plan.featured
										? 'bg-card text-card-foreground dark:bg-palette-cream dark:text-palette-navy rounded-[1.75rem] shadow-[0_18px_40px_-24px_rgba(24,36,48,0.25)] md:rounded-[2rem]'
										: 'text-foreground',
								)}
							>
								<h3 className="font-display text-[1.375rem] leading-none md:text-[1.875rem]">
									{plan.name}
								</h3>
								<p
									className={cn(
										'col-span-2 col-start-1 row-start-2 text-base md:col-span-1 md:col-start-2 md:row-start-1 md:text-[0.9375rem]',
										plan.featured
											? 'text-card-foreground dark:text-palette-navy'
											: 'text-foreground',
									)}
								>
									{plan.summary}
								</p>
								<p className="col-start-2 row-start-1 flex items-start justify-end leading-none md:col-start-3 md:justify-start">
									<span className="font-display text-base md:text-lg">$</span>
									<span className="font-display text-[1.75rem] md:text-[2.5rem]">
										{plan.dollars}
									</span>
									<span className="font-display ml-0.5 text-sm md:text-base">
										{plan.cents}
									</span>
								</p>
								<Button
									asChild
									variant={plan.featured ? 'brand' : 'outline'}
									className={cn(
										'col-span-2 mt-2 w-full md:col-span-1 md:col-start-4 md:mt-0 md:w-auto md:px-8',
										// The dark design draws the basic plan's button as a plain outline.
										!plan.featured &&
											'dark:border-foreground/50 dark:text-foreground dark:hover:bg-foreground/10 dark:bg-transparent',
									)}
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
				{/* Full-bleed on phones, a rounded card inside the container on desktop. */}
				<div className="md:container">
					<div className="bg-cta text-cta-foreground relative isolate flex flex-col justify-center overflow-hidden px-6 pt-24 pb-40 md:min-h-[25.625rem] md:rounded-[2rem] md:px-12 md:py-20">
						{/* The sun and heart are cropped by the banner edge in the design. */}
						<img
							src="/images/cta-sun.png"
							alt=""
							className="pointer-events-none absolute top-0 -left-6 w-[9.5rem] md:left-[4.8%] md:w-[11rem]"
						/>
						<img
							src="/images/cta-leaves.png"
							alt=""
							className="pointer-events-none absolute -right-4 bottom-10 w-[14rem] md:right-0 md:bottom-[8%] md:w-[16.625rem]"
						/>
						<img
							src="/images/cta-flower.png"
							alt=""
							className="pointer-events-none absolute -right-5 bottom-16 w-[11rem] md:top-[4.3%] md:right-[1.4%] md:bottom-auto md:w-[12.25rem]"
						/>
						<img
							src="/images/cta-heart.png"
							alt=""
							className="pointer-events-none absolute bottom-0 -left-6 w-[8rem] md:left-[2.9%] md:w-[11rem]"
						/>
						<div className="relative mx-auto max-w-2xl text-center">
							<h2
								id="cta-heading"
								className="font-display mx-auto max-w-[21rem] text-[2.125rem] leading-[1.2] md:max-w-none md:text-[2.25rem] md:leading-[1.15]"
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
