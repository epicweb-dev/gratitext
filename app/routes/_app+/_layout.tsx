import {
	json,
	type HeadersFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, Link, Outlet, useLoaderData, useSubmit } from '@remix-run/react'
import { useRef } from 'react'
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
import { ThemeSwitch } from '#app/routes/resources+/theme-switch.tsx'
import { getUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
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
			<header className="container py-6">
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
							<Button asChild variant="default" size="lg">
								<Link to="/login">Log In</Link>
							</Button>
						)}
					</div>
				</nav>
			</header>
			<div className="flex-1">
				<Outlet />
			</div>
			<footer className="container my-4 flex items-center justify-between pb-5 border-t border-border pt-8">
				<div className="flex items-center gap-4">
					<Logo />
					<nav>
						<ul className="flex list-none flex-col gap-2 md:flex-row md:gap-4">
							<li>
								<Link to="/about" className="text-muted-foreground hover:text-foreground">
									About
								</Link>
							</li>
							<li>
								<Link
									to="/privacy"
									className="text-muted-foreground hover:text-foreground"
								>
									Privacy
								</Link>
							</li>
							<li>
								<Link to="/tos" className="text-muted-foreground hover:text-foreground">
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									to="/support"
									className="text-muted-foreground hover:text-foreground"
								>
									Support
								</Link>
							</li>
							<li>
								<Link
									to="/contact"
									className="text-muted-foreground hover:text-foreground"
								>
									Contact
								</Link>
							</li>
						</ul>
					</nav>
				</div>
				<ThemeSwitch userPreference={requestInfo.userPrefs.theme} />
			</footer>{' '}
		</div>
	)
}

function Logo() {
	return <Link to="/">GratiText</Link>
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
							submit(formRef.current)
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
