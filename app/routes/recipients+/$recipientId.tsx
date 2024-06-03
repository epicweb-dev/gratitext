import { invariantResponse } from '@epic-web/invariant'
import { type MetaFunction, type LoaderFunctionArgs } from '@remix-run/node'
import {
	Link,
	json,
	useLoaderData,
	useMatches,
	useNavigate,
	useOutlet,
} from '@remix-run/react'
import { useEffect, useRef } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.js'
import { Button } from '#app/components/ui/button.js'
import { Icon } from '#app/components/ui/icon.js'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '#app/components/ui/tabs.js'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#app/components/ui/tooltip.js'
import { requireUserId } from '#app/utils/auth.server.js'
import { getHints } from '#app/utils/client-hints.js'
import { formatSendTime, getSendTime } from '#app/utils/cron.server.js'
import { prisma } from '#app/utils/db.server.js'

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const hints = getHints(request)
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
			scheduleCron: true,
			timeZone: true,
			verified: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	return json({
		recipient,
		formattedNextSendTime: formatSendTime(
			getSendTime(recipient.scheduleCron, { tz: recipient.timeZone }, 0),
			hints.timeZone || recipient.timeZone,
		),
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const firstLinkRef = useRef<HTMLAnchorElement | null>(null)
	const outlet = useOutlet()
	const navigate = useNavigate()
	const matches = useMatches()
	const lastMatch = matches[matches.length - 1]
	const idPortion = lastMatch?.id.split('.')?.at(-1) ?? '.'
	const tab = idPortion === 'index' ? '.' : idPortion

	useEffect(() => {
		firstLinkRef.current?.focus()
	}, [data.recipient.id])

	useEffect(() => {
		if (tab === '.') firstLinkRef.current?.focus()
	}, [tab])

	// The links are just for progressive enhancement. We disable their default
	function handleLinkClick(event: React.MouseEvent<HTMLAnchorElement>) {
		if (event.metaKey) {
			// TODO: this doesn't seem to be preventing the tab from switching properly
			event.stopPropagation()
		} else {
			event.preventDefault()
		}
	}

	return (
		<Tabs
			defaultValue="."
			onValueChange={newValue => navigate(newValue)}
			value={tab}
		>
			<div className="absolute inset-0 flex flex-col px-10">
				<h2 className="mb-2 h-36 pt-12 text-h2 lg:mb-6">
					{data.recipient.name}
					<small className="block text-sm font-normal text-secondary-foreground">
						{data.recipient.phoneNumber}{' '}
						{data.recipient.verified ? (
							''
						) : (
							<Link
								to="edit"
								className="text-body-2xs text-destructive underline"
							>
								(unverified)
							</Link>
						)}
						<Tooltip>
							<TooltipTrigger className="cursor-default">
								{data.formattedNextSendTime}
							</TooltipTrigger>
							<TooltipContent>Next send time</TooltipContent>
						</Tooltip>
					</small>
				</h2>
				<div className="absolute left-3 right-3 top-[8.7rem] rounded-lg bg-muted/80 px-2 py-2 shadow-xl shadow-accent backdrop-blur-sm">
					<TabsList className="grid w-full grid-cols-3 bg-transparent">
						<TabsTrigger value="." asChild>
							<Link
								to="."
								preventScrollReset
								onClick={handleLinkClick}
								ref={firstLinkRef}
							>
								Upcoming
							</Link>
						</TabsTrigger>
						<TabsTrigger value="new" asChild>
							<Link to="new" preventScrollReset onClick={handleLinkClick}>
								New
							</Link>
						</TabsTrigger>
						<TabsTrigger value="past" asChild>
							<Link to="past" preventScrollReset onClick={handleLinkClick}>
								Past
							</Link>
						</TabsTrigger>
					</TabsList>
				</div>
				<div className="overflow-y-auto px-4 py-24">
					<TabsContent value=".">{outlet}</TabsContent>
					<TabsContent value="new">{outlet}</TabsContent>
					<TabsContent value="past">{outlet}</TabsContent>
				</div>
				<div className={floatingToolbarClassName}>
					<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
						<Button
							asChild
							className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
						>
							<Link to="edit">
								<Icon name="pencil-1" className="scale-125 max-md:scale-150">
									<span className="max-md:hidden">Edit</span>
								</Icon>
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</Tabs>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => (
					<p>No recipient with the id "{params.recipientId}" exists</p>
				),
			}}
		/>
	)
}
