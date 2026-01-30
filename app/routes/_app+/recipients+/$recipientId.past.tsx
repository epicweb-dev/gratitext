import { invariantResponse } from '@epic-web/invariant'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from '@remix-run/react'
import { useId } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDebounce, useDelayedIsPending } from '#app/utils/misc.tsx'

const PAGE_SIZE = 100

const SearchParamsSchema = z.object({
	search: z.string().optional().default(''),
	page: z.coerce.number().int().positive().optional().default(1),
})

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const searchParams = SearchParamsSchema.safeParse(
		Object.fromEntries(url.searchParams),
	)

	const { search, page } = searchParams.success
		? searchParams.data
		: { search: '', page: 1 }

	// Verify the recipient belongs to the user
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
		...(search
			? { content: { contains: search } }
			: {}),
	}

	// Get total count for pagination
	const totalMessages = await prisma.message.count({
		where: messageWhere,
	})

	// Calculate pagination
	const totalPages = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE))
	const currentPage = Math.min(page, totalPages)
	const skip = (currentPage - 1) * PAGE_SIZE

	// Fetch paginated messages
	const messages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: { sentAt: 'desc' },
		skip,
		take: PAGE_SIZE,
	})

	return json({
		recipient,
		search,
		pagination: {
			currentPage,
			totalPages,
			totalMessages,
			pageSize: PAGE_SIZE,
			hasNextPage: currentPage < totalPages,
			hasPreviousPage: currentPage > 1,
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

export default function RecipientRoute() {
	const data = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const submit = useSubmit()
	const searchId = useId()
	const isPending = useDelayedIsPending({ formMethod: 'GET' })

	const handleSearchChange = useDebounce((form: HTMLFormElement) => {
		// Reset to page 1 when search changes
		const formData = new FormData(form)
		formData.delete('page')
		submit(formData, { method: 'GET' })
	}, 400)

	const { pagination } = data

	return (
		<div>
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<p>
					{data.search ? (
						<>
							Found <strong>{pagination.totalMessages.toLocaleString()}</strong>{' '}
							{pagination.totalMessages === 1 ? 'message' : 'messages'} matching
							&quot;{data.search}&quot;
						</>
					) : (
						<>
							You have sent{' '}
							<strong>{pagination.totalMessages.toLocaleString()}</strong>{' '}
							{pagination.totalMessages === 1 ? 'message' : 'messages'} to{' '}
							{data.recipient.name}.
						</>
					)}
				</p>
			</div>

			{/* Search Form */}
			<Form
				method="GET"
				className="mb-6 flex flex-wrap items-center gap-2"
				onChange={(e) => handleSearchChange(e.currentTarget)}
			>
				<div className="flex-1">
					<Label htmlFor={searchId} className="sr-only">
						Search messages
					</Label>
					<Input
						type="search"
						name="search"
						id={searchId}
						defaultValue={searchParams.get('search') ?? ''}
						placeholder="Search messages..."
						className="w-full"
					/>
				</div>
				<div>
					<StatusButton
						type="submit"
						status={isPending ? 'pending' : 'idle'}
						className="flex items-center justify-center"
					>
						<Icon name="magnifying-glass" size="md" />
						<span className="sr-only">Search</span>
					</StatusButton>
				</div>
				{data.search ? (
					<Link
						to="."
						className="text-sm text-muted-foreground underline hover:text-foreground"
					>
						Clear search
					</Link>
				) : null}
			</Form>

			{/* Messages List */}
			<ul
				className={cn('flex flex-col gap-2', {
					'opacity-50': isPending,
				})}
			>
				{data.pastMessages.length > 0 ? (
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
				) : (
					<li className="text-muted-foreground">
						{data.search ? 'No messages found matching your search.' : 'No past messages yet.'}
					</li>
				)}
			</ul>

			{/* Pagination Controls */}
			{pagination.totalPages > 1 ? (
				<nav className="mt-8 flex items-center justify-center gap-4">
					{pagination.hasPreviousPage ? (
						<Link
							to={`?${new URLSearchParams({
								...(data.search ? { search: data.search } : {}),
								page: String(pagination.currentPage - 1),
							}).toString()}`}
							className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
							preventScrollReset
						>
							<Icon name="arrow-left" size="sm" />
							Previous
						</Link>
					) : (
						<span className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm opacity-50">
							<Icon name="arrow-left" size="sm" />
							Previous
						</span>
					)}

					<span className="text-sm text-muted-foreground">
						Page {pagination.currentPage} of {pagination.totalPages}
					</span>

					{pagination.hasNextPage ? (
						<Link
							to={`?${new URLSearchParams({
								...(data.search ? { search: data.search } : {}),
								page: String(pagination.currentPage + 1),
							}).toString()}`}
							className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
							preventScrollReset
						>
							Next
							<Icon name="arrow-right" size="sm" />
						</Link>
					) : (
						<span className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm opacity-50">
							Next
							<Icon name="arrow-right" size="sm" />
						</span>
					)}
				</nav>
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
