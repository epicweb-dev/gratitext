import { useRef, useState } from 'react'
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
	useSubmit,
} from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { Button } from '#app/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
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

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data ? 'GratiText' : 'Error | GratiText' },
		{ name: 'description', content: `Your own captain's log` },
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

export default function Layout() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const requestInfo = useRequestInfo()
	return (
		<div className="flex h-screen flex-col justify-between">
			<header className="container py-4 md:py-6">
				<nav className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap md:gap-8">
					<Logo />
					<div className="flex items-center gap-10">
						{user ? (
							<div className="flex gap-4">
								{data.isSubscribed ? null : (
									<Button variant="outline" asChild>
										<Link to="/settings/profile/subscription">
											Start your free trial
										</Link>
									</Button>
								)}
								<UserDropdown />
							</div>
						) : (
							<>
								<Button
									asChild
									variant="default"
									size="lg"
									className="hidden sm:inline-flex"
								>
									<Link to="/login">Log In</Link>
								</Button>
								<div className="sm:hidden">
									<MobileMenu />
								</div>
							</>
						)}
					</div>
				</nav>
			</header>
			<div className="flex-1">
				<Outlet />
			</div>
			<footer className="container my-4 flex flex-col gap-4 pb-5 md:flex-row md:items-center md:justify-between">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
					<Logo />
					<nav>
						<ul className="flex list-none flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
							<li>
								<Link to="/about" className="text-gray-600 hover:text-gray-900">
									About
								</Link>
							</li>
							<li>
								<Link
									to="/privacy"
									className="text-gray-600 hover:text-gray-900"
								>
									Privacy
								</Link>
							</li>
							<li>
								<Link to="/tos" className="text-gray-600 hover:text-gray-900">
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									to="/support"
									className="text-gray-600 hover:text-gray-900"
								>
									Support
								</Link>
							</li>
							<li>
								<Link
									to="/contact"
									className="text-gray-600 hover:text-gray-900"
								>
									Contact
								</Link>
							</li>
						</ul>
					</nav>
				</div>
				<div className="flex items-center self-start md:self-auto">
					<ThemeSwitch userPreference={requestInfo.userPrefs.theme} />
				</div>
			</footer>{' '}
		</div>
	)
}

function Logo() {
	return (
		<Link
			to="/"
			className={cn(
				'font-serif text-lg font-semibold lowercase tracking-tight text-foreground md:text-xl',
			)}
		>
			gratitetext
		</Link>
	)
}

function UserDropdown() {
	const user = useUser()
	const submit = useSubmit()
	const formRef = useRef<HTMLFormElement>(null)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button asChild variant="secondary">
					<Link
						to={`/users/${user.username}`}
						// this is for progressive enhancement
						onClick={(e) => e.preventDefault()}
						className="flex items-center gap-2"
					>
						<span className="text-body-sm font-bold">
							{user.name ?? user.username}
						</span>
					</Link>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent sideOffset={8} align="start">
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to={`/users/${user.username}`}>
							<Icon className="text-body-md" name="avatar">
								Profile
							</Icon>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link prefetch="intent" to={`/recipients`}>
							<Icon className="text-body-md" name="pencil-2">
								Recipients
							</Icon>
						</Link>
					</DropdownMenuItem>
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

	return (
		<>
			<button
				type="button"
				className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted"
				aria-label="Open menu"
				aria-expanded={open}
				aria-controls="mobile-menu-panel"
				onClick={() => setOpen(true)}
			>
				<Icon name="menu" size="lg" aria-hidden="true" />
			</button>
			{open ? (
				<div className="fixed inset-0 z-50 flex justify-center">
					<button
						type="button"
						className="absolute inset-0 h-full w-full bg-black/20"
						onClick={() => setOpen(false)}
						aria-label="Close menu"
					/>
					<div
						id="mobile-menu-panel"
						className="relative mx-4 mt-4 w-full max-w-[420px] rounded-[32px] bg-card px-6 pb-6 pt-5 shadow-[0_20px_45px_rgba(0,0,0,0.18)]"
					>
						<div className="flex items-center justify-between">
							<Logo />
							<button
								type="button"
								className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted"
								onClick={() => setOpen(false)}
								aria-label="Close menu"
							>
								<Icon name="close" size="lg" aria-hidden="true" />
							</button>
						</div>
						<Button
							asChild
							size="lg"
							className="mt-6 w-full bg-[hsl(var(--palette-orange))] text-[hsl(var(--palette-cream))] hover:bg-[hsl(var(--palette-chestnut))]"
						>
							<Link to="/login" onClick={() => setOpen(false)}>
								<Icon name="star" size="sm" aria-hidden="true">
									Start 14-day FREE Trial
								</Icon>
							</Link>
						</Button>
						<div className="mt-4 grid gap-3 text-body-sm font-semibold text-foreground">
							<Link
								to="/login"
								onClick={() => setOpen(false)}
								className="flex items-center gap-3"
							>
								<Icon
									name="log in"
									size="sm"
									className="text-[hsl(var(--palette-cloud))]"
									aria-hidden="true"
								/>
								Log In
							</Link>
							<div className="h-px bg-border" />
							<fetcher.Form method="POST" action="/resources/theme-switch">
								<input type="hidden" name="theme" value={nextTheme} />
								<button
									type="submit"
									onClick={() => setOpen(false)}
									className="flex w-full items-center gap-3"
								>
									<Icon
										name={themeIcon}
										size="sm"
										className="text-[hsl(var(--palette-cloud))]"
										aria-hidden="true"
									/>
									{themeLabel}
								</button>
							</fetcher.Form>
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
