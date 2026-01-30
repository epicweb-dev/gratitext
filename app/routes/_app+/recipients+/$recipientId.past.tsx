import { invariantResponse } from '@epic-web/invariant'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react'
import { useId } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDebounce, useDelayedIsPending } from '#app/utils/misc.tsx'

const MESSAGES_PER_PAGE = 100

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const searchQuery = url.searchParams.get('search') ?? ''
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
	
	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			name: true,
			phoneNumber: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	// Build the where clause for messages
	const messageWhere = {
		recipientId: params.recipientId,
		sentAt: { not: null },
		...(searchQuery
			? { content: { contains: searchQuery } }
			: {}),
	}

	// Get total count for pagination
	const totalMessages = await prisma.message.count({
		where: messageWhere,
	})

	const totalPages = Math.max(1, Math.ceil(totalMessages / MESSAGES_PER_PAGE))
	const currentPage = Math.min(page, totalPages)

	// Get paginated messages
	const messages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: { sentAt: 'desc' },
		skip: (currentPage - 1) * MESSAGES_PER_PAGE,
		take: MESSAGES_PER_PAGE,
	})

	return json({
		recipient,
		searchQuery,
		pagination: {
			currentPage,
			totalPages,
			totalMessages,
			hasNextPage: currentPage < totalPages,
			hasPrevPage: currentPage > 1,
		},
		pastMessages: messages.map((m) => ({
			id: m.id,
			sentAtDisplay: m.sentAt!.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: 'numeric',
			}),
			content: m.content,
		})),
	})
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `Past Messages | ${data?.recipient.name ?? data?.recipient.phoneNumber} | GratiText`,
		},
	]
}

function MessageSearchBar() {
	const id = useId()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
	})

	const handleFormChange = useDebounce((form: HTMLFormElement) => {
		submit(form)
	}, 400)

	return (
		<Form
			method="GET"
			className="flex flex-wrap items-center gap-2"
			onChange={(e) => handleFormChange(e.currentTarget)}
		>
			<div className="flex-1">
				<Label htmlFor={id} className="sr-only">
					Search messages
				</Label>
				<Input
					type="search"
					name="search"
					id={id}
					defaultValue={searchParams.get('search') ?? ''}
					placeholder="Search messages..."
					className="w-full"
				/>
			</div>
			<Button type="submit" variant="outline" size="icon" className="shrink-0">
				<Icon name="magnifying-glass" size="md" />
				<span className="sr-only">Search</span>
			</Button>
			{isPending ? (
				<span className="text-sm text-muted-foreground">Searching...</span>
			) : null}
		</Form>
	)
}

function Pagination({
	currentPage,
	totalPages,
	totalMessages,
	searchQuery,
}: {
	currentPage: number
	totalPages: number
	totalMessages: number
	searchQuery: string
}) {
	const [searchParams] = useSearchParams()
	
	const buildPageUrl = (page: number) => {
		const params = new URLSearchParams(searchParams)
		if (page === 1) {
			params.delete('page')
		} else {
			params.set('page', page.toString())
		}
		const queryString = params.toString()
		return queryString ? `?${queryString}` : '.'
	}

	const hasPrevPage = currentPage > 1
	const hasNextPage = currentPage < totalPages

	return (
		<div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
			<p className="text-sm text-muted-foreground">
				{totalMessages === 0
					? 'No messages found'
					: `Showing ${((currentPage - 1) * MESSAGES_PER_PAGE) + 1}-${Math.min(currentPage * MESSAGES_PER_PAGE, totalMessages)} of ${totalMessages.toLocaleString()} message${totalMessages === 1 ? '' : 's'}`}
				{searchQuery ? (
					<>
						{' '}
						matching "<strong>{searchQuery}</strong>"
					</>
				) : null}
			</p>
			{totalPages > 1 ? (
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						asChild={hasPrevPage}
						disabled={!hasPrevPage}
					>
						{hasPrevPage ? (
							<Link to={buildPageUrl(currentPage - 1)} preventScrollReset>
								<Icon name="arrow-left" size="sm" />
								Previous
							</Link>
						) : (
							<span>
								<Icon name="arrow-left" size="sm" />
								Previous
							</span>
						)}
					</Button>
					<span className="px-2 text-sm">
						Page {currentPage} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						asChild={hasNextPage}
						disabled={!hasNextPage}
					>
						{hasNextPage ? (
							<Link to={buildPageUrl(currentPage + 1)} preventScrollReset>
								Next
								<Icon name="arrow-right" size="sm" />
							</Link>
						) : (
							<span>
								Next
								<Icon name="arrow-right" size="sm" />
							</span>
						)}
					</Button>
				</div>
			) : null}
		</div>
	)
}

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
	})

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4">
				<MessageSearchBar />
				<Pagination
					currentPage={data.pagination.currentPage}
					totalPages={data.pagination.totalPages}
					totalMessages={data.pagination.totalMessages}
					searchQuery={data.searchQuery}
				/>
			</div>

			<ul className={cn('flex flex-col gap-2', { 'opacity-50': isPending })}>
				{data.pastMessages.length === 0 ? (
					<li className="py-8 text-center text-muted-foreground">
						{data.searchQuery
							? 'No messages match your search.'
							: 'No past messages yet.'}
					</li>
				) : (
					data.pastMessages.map((m) => (
						<li
							key={m.id}
							className="flex flex-col justify-start gap-2 align-top lg:flex-row"
						>
							<span className="min-w-36 text-muted-secondary-foreground">
								{m.sentAtDisplay}
							</span>
							<span>{m.content}</span>
						</li>
					))
				)}
			</ul>

			{data.pastMessages.length > 0 && data.pagination.totalPages > 1 ? (
				<Pagination
					currentPage={data.pagination.currentPage}
					totalPages={data.pagination.totalPages}
					totalMessages={data.pagination.totalMessages}
					searchQuery={data.searchQuery}
				/>
			) : null}
		</div>
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
