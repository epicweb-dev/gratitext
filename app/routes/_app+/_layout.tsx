import { useEffect, useRef, useState } from 'react'
import {
	Form,
	Link,
	Outlet,
	data as json,
	type HeadersFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	useFetcher,
	useLoaderData,
	useMatches,
	useSubmit,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Wordmark } from '#app/components/wordmark.tsx'
import { ThemeSwitch, useTheme } from '#app/routes/resources+/theme-switch.tsx'
import { getUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'
import {
	getSubscriptionTier,
	type SubscriptionTier,
} from '#app/utils/stripe.server.ts'
import { makeTimings } from '#app/utils/timing.server.ts'
import { useOptionalUser, useUser } from '#app/utils/user.ts'

const siteDescription =
	'GratiText helps you send thoughtful, personal gratitude texts to the people you love on a schedule you choose.'

const focusableSelector = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',')

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data ? 'GratiText' : 'Error | GratiText' },
		{ name: 'description', content: siteDescription },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const timings = makeTimings('app layout loader')
	const userId = await getUserId(request)
	const user = userId
		? await prisma.user.findUnique({
				select: { stripeId: true },
				where: { id: userId },
			})
		: null

	return json(
		{ subscriptionTier: await getSubscriptionTier(user?.stripeId) },
		{ headers: { 'Server-Timing': timings.toString() } },
	)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
	return headers
}

const supportEmail = 'support@gratitext.app'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

export default function Layout() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const matches = useMatches()
	const handles = matches.map((match) => match.handle).filter(isRecord)
	// Auth pages are full-bleed beige on phones and the dashboard sits on cream,
	// so the header and footer follow the page colour.
	const pageTint = handles.find((handle) => handle.pageTint)?.pageTint
	const minimalChrome = handles.some((handle) => handle.chrome === 'minimal')
	return (
		<div
			className={cn(
				'text-foreground flex min-h-screen flex-col',
				pageTint === 'hero'
					? 'bg-hero md:bg-background'
					: pageTint === 'surface'
						? 'bg-surface'
						: 'bg-background',
			)}
		>
			<a
				href="#main-content"
				className="bg-primary text-primary-foreground sr-only rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
			>
				Skip to content
			</a>
			<header className="border-border relative z-40 border-b">
				<div className="container flex h-[4.5rem] items-center justify-between gap-4 md:h-[5.5rem]">
					<Wordmark />
					<div className="hidden items-center gap-3 md:flex">
						{user ? (
							<>
								{data.subscriptionTier === 'basic' ? (
									<Button asChild variant="warning" size="sm">
										<Link to="/settings/profile/subscription">
											<Icon name="upgrade" size="xs" aria-hidden="true" />
											Upgrade to 10 Messages a Day
										</Link>
									</Button>
								) : null}
								<UserDropdown subscriptionTier={data.subscriptionTier} />
							</>
						) : minimalChrome ? null : (
							<>
								<Button asChild size="sm">
									<Link to="/signup">Start 14-day FREE trial</Link>
								</Button>
								<Button asChild variant="outline" size="sm">
									<Link to="/login">Log In</Link>
								</Button>
							</>
						)}
						<ThemeSwitch />
					</div>
					<div className="md:hidden">
						<MobileMenu subscriptionTier={data.subscriptionTier} />
					</div>
				</div>
			</header>
			<div id="main-content" className="flex flex-1 flex-col">
				<Outlet />
			</div>
			<footer className="mt-auto">
				<div className="container flex flex-col items-center gap-6 py-10 text-center md:flex-row md:items-center md:justify-between md:text-left">
					<div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
						<Wordmark className="text-xl" />
						<nav aria-label="Footer">
							<ul className="flex flex-col items-center gap-5 text-sm font-semibold md:flex-row md:gap-8">
								<li>
									<a
										href={`mailto:${supportEmail}`}
										className="text-foreground hover:text-brand transition-colors"
									>
										Contact
									</a>
								</li>
								<li>
									<Link
										to="/about"
										prefetch="intent"
										className="text-foreground hover:text-brand transition-colors"
									>
										About
									</Link>
								</li>
							</ul>
						</nav>
					</div>
					<ul className="text-muted-foreground flex flex-col items-center gap-5 text-sm md:flex-row md:gap-8">
						<li>All Rights Reserved</li>
						<li>
							<Link
								to="/tos"
								prefetch="intent"
								className="hover:text-foreground transition-colors"
							>
								Terms and Conditions
							</Link>
						</li>
						<li>
							<Link
								to="/privacy"
								prefetch="intent"
								className="hover:text-foreground transition-colors"
							>
								Privacy Policy
							</Link>
						</li>
					</ul>
				</div>
			</footer>
		</div>
	)
}

function UserDropdown({
	subscriptionTier,
}: {
	subscriptionTier: SubscriptionTier
}) {
	const user = useUser()
	const submit = useSubmit()
	const formRef = useRef<HTMLFormElement>(null)
	const displayName = user.name ?? user.username
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button asChild variant="ghost" size="sm" className="gap-1.5 px-3">
					<Link
						to={`/users/${user.username}`}
						// this is for progressive enhancement
						onClick={(e) => e.preventDefault()}
						className="flex items-center"
					>
						<Icon name="avatar" size="sm" aria-hidden="true" />
						<span className="max-w-[8rem] truncate text-xs font-semibold sm:max-w-[12rem]">
							{displayName}
						</span>
						<Icon
							name="chevron-down"
							size="xs"
							className="text-muted-foreground"
							aria-hidden="true"
						/>
					</Link>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent sideOffset={8} align="end" className="w-60">
					{subscriptionTier === 'premium' ? null : (
						<>
							<DropdownMenuItem asChild>
								<Link prefetch="intent" to="/settings/profile/subscription">
									<Icon className="text-body-md" name="upgrade">
										{subscriptionTier === 'basic'
											? 'Upgrade to Premium Account'
											: 'Start 14-day FREE Trial'}
									</Icon>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to={`/users/${user.username}`}>
							<Icon className="text-body-md" name="avatar">
								Profile
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to="/recipients">
							<Icon className="text-body-md" name="message">
								Recipients
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to="/settings/profile">
							<Icon className="text-body-md" name="options">
								Account Settings
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						asChild
						// this prevents the menu from closing before the form submission is completed
						onSelect={(event) => {
							event.preventDefault()
							if (formRef.current) {
								void submit(formRef.current)
							}
						}}
					>
						<Form action="/logout" method="POST" ref={formRef}>
							<Icon className="text-body-md" name="log out">
								<button type="submit">Logout</button>
							</Icon>
						</Form>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

const mobileRowClassName =
	'text-foreground hover:bg-surface flex w-full items-center gap-4 rounded-xl px-2 py-3.5 text-left text-base font-medium transition-colors'

function MobileMenu({
	subscriptionTier,
}: {
	subscriptionTier: SubscriptionTier
}) {
	const [open, setOpen] = useState(false)
	const user = useOptionalUser()
	const theme = useTheme()
	const fetcher = useFetcher()
	const nextTheme = theme === 'dark' ? 'light' : 'dark'
	const themeLabel =
		theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'
	const themeIcon = theme === 'dark' ? 'sun' : 'moon'
	const close = () => setOpen(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	// The panel is announced as a modal dialog, so it has to behave like one:
	// move focus into it on open, keep Tab cycling inside it, and hand focus
	// back to the trigger when it closes.
	useEffect(() => {
		if (!open) return
		const panel = panelRef.current
		const trigger = triggerRef.current
		if (!panel) return
		const getFocusable = () =>
			Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
				(element) => !element.hasAttribute('disabled'),
			)

		panel.focus({ preventScroll: true })

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				setOpen(false)
				return
			}
			if (event.key !== 'Tab') return
			const focusable = getFocusable()
			if (focusable.length === 0) {
				event.preventDefault()
				return
			}
			const first = focusable[0]!
			const last = focusable[focusable.length - 1]!
			const active = document.activeElement
			const activeIndex = focusable.findIndex((element) => element === active)
			if (event.shiftKey) {
				if (activeIndex <= 0) {
					event.preventDefault()
					last.focus()
				}
			} else if (activeIndex === -1 || activeIndex === focusable.length - 1) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('keydown', onKeyDown)
			if (trigger?.isConnected) trigger.focus({ preventScroll: true })
		}
	}, [open])

	return (
		<>
			<Button
				ref={triggerRef}
				type="button"
				variant="ghost"
				size="icon"
				aria-label="Open menu"
				aria-expanded={open}
				aria-controls="mobile-menu-panel"
				onClick={() => setOpen(true)}
				className="-mr-2"
			>
				<Icon name="menu" size="lg" aria-hidden="true" />
			</Button>
			{open ? (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						tabIndex={-1}
						className="bg-overlay/60 absolute inset-0 h-full w-full backdrop-blur-[2px]"
						onClick={close}
						aria-label="Close menu"
					/>
					<div
						ref={panelRef}
						id="mobile-menu-panel"
						role="dialog"
						aria-modal="true"
						aria-label="Menu"
						tabIndex={-1}
						className="bg-card text-card-foreground relative w-full rounded-b-[1.75rem] px-5 pt-3 pb-4 shadow-[0_24px_48px_-24px_rgba(24,36,48,0.35)] outline-none"
					>
						<div className="flex h-[3.75rem] items-center justify-between">
							<Wordmark onClick={close} />
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={close}
								aria-label="Close menu"
								className="-mr-2"
							>
								<Icon name="close" size="lg" aria-hidden="true" />
							</Button>
						</div>
						<div className="mt-3">
							{user ? (
								<>
									{subscriptionTier === 'premium' ? null : (
										<Button
											asChild
											size="lg"
											variant="warning"
											className="w-full"
										>
											<Link to="/settings/profile/subscription" onClick={close}>
												<Icon name="star" size="sm" aria-hidden="true" />
												{subscriptionTier === 'basic'
													? 'Upgrade to Premium Account'
													: 'Start 14-day FREE Trial'}
											</Link>
										</Button>
									)}
									<nav
										aria-label="Mobile"
										className="divide-border mt-2 divide-y"
									>
										<Link
											to="/recipients"
											onClick={close}
											className={mobileRowClassName}
										>
											<Icon name="message" size="md" aria-hidden="true" />
											Recipients
										</Link>
										<Link
											to="/settings/profile"
											onClick={close}
											className={mobileRowClassName}
										>
											<Icon name="settings" size="md" aria-hidden="true" />
											Settings
										</Link>
										<Form action="/logout" method="POST">
											<button type="submit" className={mobileRowClassName}>
												<Icon name="exit" size="md" aria-hidden="true" />
												Logout
											</button>
										</Form>
									</nav>
								</>
							) : (
								<>
									<Button
										asChild
										size="lg"
										variant="warning"
										className="w-full"
									>
										<Link to="/signup" onClick={close}>
											<Icon name="star" size="sm" aria-hidden="true" />
											Start 14-day FREE Trial
										</Link>
									</Button>
									<nav
										aria-label="Mobile"
										className="divide-border mt-2 divide-y"
									>
										<Link
											to="/login"
											onClick={close}
											className={mobileRowClassName}
										>
											<Icon name="log in" size="md" aria-hidden="true" />
											Log In
										</Link>
									</nav>
								</>
							)}
							<div className="border-border border-t">
								<fetcher.Form method="POST" action="/resources/theme-switch">
									<input type="hidden" name="theme" value={nextTheme} />
									<button
										type="submit"
										onClick={close}
										className={mobileRowClassName}
									>
										<Icon name={themeIcon} size="md" aria-hidden="true" />
										{themeLabel}
									</button>
								</fetcher.Form>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
