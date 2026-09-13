import { useEffect, useRef, useState } from 'react'
import {
	Form,
	Link,
	NavLink,
	Outlet,
	data as json,
	type HeadersFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	useFetcher,
	useLoaderData,
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
import { ThemeSwitch, useTheme } from '#app/routes/resources+/theme-switch.tsx'
import { getUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { useRequestInfo } from '#app/utils/request-info.js'
import { getCustomerProducts } from '#app/utils/stripe.server.ts'
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
		{
			isSubscribed: user?.stripeId
				? Boolean((await getCustomerProducts(user.stripeId)).products.length)
				: false,
		},
		{ headers: { 'Server-Timing': timings.toString() } },
	)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
	return headers
}

const marketingLinks = [
	{ to: '/about', label: 'About' },
	{ to: '/#pricing', label: 'Pricing' },
	{ to: '/support', label: 'Support' },
]

const appLinks = [
	{ to: '/recipients', label: 'Recipients' },
	{ to: '/settings/profile', label: 'Settings' },
]

const footerLinks = [
	{ to: '/about', label: 'About' },
	{ to: '/privacy', label: 'Privacy' },
	{ to: '/tos', label: 'Terms of Service' },
	{ to: '/support', label: 'Support' },
]

const supportEmail = 'support@gratitext.app'

function navLinkClassName({ isActive }: { isActive: boolean }) {
	return cn(
		'rounded-full px-3 py-2 text-sm font-semibold transition-colors',
		isActive
			? 'bg-muted text-foreground'
			: 'text-muted-foreground hover:bg-muted hover:text-foreground',
	)
}

export default function Layout() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const requestInfo = useRequestInfo()
	const primaryLinks = user ? appLinks : marketingLinks
	return (
		<div className="bg-background flex min-h-screen flex-col">
			<a
				href="#main-content"
				className="bg-primary text-primary-foreground sr-only rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
			>
				Skip to content
			</a>
			<header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
				<div className="container flex h-16 items-center justify-between gap-4 md:h-20">
					<div className="flex items-center gap-6 lg:gap-10">
						<Logo />
						<nav
							aria-label="Primary"
							className="hidden items-center gap-1 md:flex"
						>
							{primaryLinks.map((link) =>
								link.to.includes('#') ? (
									<Link
										key={link.to}
										to={link.to}
										className={navLinkClassName({ isActive: false })}
									>
										{link.label}
									</Link>
								) : (
									<NavLink
										key={link.to}
										to={link.to}
										prefetch="intent"
										className={navLinkClassName}
									>
										{link.label}
									</NavLink>
								),
							)}
						</nav>
					</div>
					<div className="flex items-center gap-2 sm:gap-3">
						{user ? (
							<>
								{data.isSubscribed ? null : (
									<Button
										variant="brand"
										size="sm"
										asChild
										className="hidden sm:inline-flex"
									>
										<Link to="/settings/profile/subscription">
											Start your free trial
										</Link>
									</Button>
								)}
								<UserDropdown />
							</>
						) : (
							<>
								<Button
									asChild
									variant="ghost"
									className="hidden sm:inline-flex"
								>
									<Link to="/login">Log In</Link>
								</Button>
								<Button
									asChild
									variant="brand"
									className="hidden sm:inline-flex"
								>
									<Link to="/signup">Start free trial</Link>
								</Button>
								<div className="sm:hidden">
									<MobileMenu />
								</div>
							</>
						)}
					</div>
				</div>
			</header>
			<div id="main-content" className="flex flex-1 flex-col">
				<Outlet />
			</div>
			<footer className="border-border mt-auto border-t">
				<div className="container flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
					<div className="flex max-w-xs flex-col gap-3">
						<Logo />
						<p className="text-muted-foreground text-sm leading-relaxed">
							Thoughtful gratitude texts, written by you and delivered on a
							schedule you choose.
						</p>
					</div>
					<nav aria-label="Footer">
						<ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
							{footerLinks.map((link) => (
								<li key={link.to}>
									<Link
										to={link.to}
										prefetch="intent"
										className="text-muted-foreground hover:text-foreground font-medium transition-colors"
									>
										{link.label}
									</Link>
								</li>
							))}
							<li>
								<a
									href={`mailto:${supportEmail}`}
									className="text-muted-foreground hover:text-foreground font-medium transition-colors"
								>
									Contact
								</a>
							</li>
						</ul>
					</nav>
					<div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
						<ThemeSwitch userPreference={requestInfo.userPrefs.theme} />
						<p className="text-muted-foreground text-xs">
							© {new Date().getFullYear()} GratiText
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}

function Logo({ onClick }: { onClick?: () => void }) {
	return (
		<Link
			to="/"
			onClick={onClick}
			aria-label="GratiText home"
			className="text-foreground inline-flex items-center gap-2 font-serif text-xl leading-none font-semibold tracking-tight lowercase md:text-2xl"
		>
			<span className="bg-brand text-brand-foreground flex h-8 w-8 items-center justify-center rounded-full">
				<Icon name="message" size="sm" aria-hidden="true" />
			</span>
			gratitext
		</Link>
	)
}

function UserDropdown() {
	const user = useUser()
	const submit = useSubmit()
	const formRef = useRef<HTMLFormElement>(null)
	const displayName = user.name ?? user.username
	const initial = displayName.trim().charAt(0).toUpperCase() || '?'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					asChild
					variant="secondary"
					className="h-11 gap-2 pr-4 pl-1.5 sm:h-12"
				>
					<Link
						to={`/users/${user.username}`}
						// this is for progressive enhancement
						onClick={(e) => e.preventDefault()}
						className="flex items-center gap-2"
					>
						<span
							aria-hidden="true"
							className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
						>
							{initial}
						</span>
						<span className="max-w-[8rem] truncate text-sm font-bold sm:max-w-[12rem]">
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
				<DropdownMenuContent sideOffset={8} align="end" className="w-56">
					<div className="px-3 pt-2 pb-2">
						<p className="text-foreground truncate text-sm font-semibold">
							{displayName}
						</p>
						<p className="text-muted-foreground truncate text-xs">
							@{user.username}
						</p>
					</div>
					<DropdownMenuSeparator />
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
							<Icon className="text-body-md" name="settings">
								Settings
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
							<Icon className="text-body-md" name="exit">
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

function MobileMenu() {
	const [open, setOpen] = useState(false)
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
			>
				<Icon name="menu" size="lg" aria-hidden="true" />
			</Button>
			{open ? (
				<div className="fixed inset-0 z-50 flex justify-center">
					<button
						type="button"
						tabIndex={-1}
						className="bg-overlay/40 absolute inset-0 h-full w-full"
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
						className="bg-card border-border relative mx-4 mt-3 h-fit w-full max-w-[420px] rounded-[28px] border px-5 pt-4 pb-5 shadow-2xl outline-none"
					>
						<div className="flex items-center justify-between">
							<Logo onClick={close} />
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={close}
								aria-label="Close menu"
							>
								<Icon name="close" size="lg" aria-hidden="true" />
							</Button>
						</div>
						<nav aria-label="Mobile" className="mt-4 grid gap-1">
							{marketingLinks.map((link) => (
								<Link
									key={link.to}
									to={link.to}
									onClick={close}
									className="text-foreground hover:bg-muted flex items-center rounded-xl px-3 py-2.5 text-base font-semibold"
								>
									{link.label}
								</Link>
							))}
						</nav>
						<div className="bg-border my-3 h-px" />
						<div className="grid gap-2">
							<Button asChild size="lg" variant="brand" className="w-full">
								<Link to="/signup" onClick={close}>
									<Icon name="star" size="sm" aria-hidden="true">
										Start your 14-day free trial
									</Icon>
								</Link>
							</Button>
							<Button asChild size="lg" variant="secondary" className="w-full">
								<Link to="/login" onClick={close}>
									<Icon name="log in" size="sm" aria-hidden="true">
										Log In
									</Icon>
								</Link>
							</Button>
						</div>
						<div className="bg-border my-3 h-px" />
						<fetcher.Form method="POST" action="/resources/theme-switch">
							<input type="hidden" name="theme" value={nextTheme} />
							<button
								type="submit"
								onClick={close}
								className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
							>
								<Icon name={themeIcon} size="sm" aria-hidden="true" />
								{themeLabel}
							</button>
						</fetcher.Form>
					</div>
				</div>
			) : null}
		</>
	)
}
