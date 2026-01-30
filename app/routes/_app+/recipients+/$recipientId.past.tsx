import { invariantResponse } from '@epic-web/invariant'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useSearchParams } from '@remix-run/react'
import { useId } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const PAGE_SIZE = 100

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const recipientId = params.recipientId
	invariantResponse(recipientId, 'Recipient id is required', { status: 400 })
	const url = new URL(request.url)
	const searchTerm = url.searchParams.get('search')?.trim() ?? ''
	const pageParam = url.searchParams.get('page') ?? '1'
	const parsedPage = Number.parseInt(pageParam, 10)
	const requestedPage = Number.isNaN(parsedPage) ? 1 : parsedPage
	const page = Math.max(1, requestedPage)
	const recipient = await prisma.recipient.findUnique({
		where: { id: recipientId, userId },
		select: {
			name: true,
			phoneNumber: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const baseMessageWhere = {
		recipientId,
		sentAt: { not: null },
	}
	const messageWhere = searchTerm
		? {
				...baseMessageWhere,
				content: { contains: searchTerm },
			}
		: baseMessageWhere

	const totalMessageCountPromise = prisma.message.count({
		where: baseMessageWhere,
	})
	const filteredMessageCountPromise = searchTerm
		? prisma.message.count({ where: messageWhere })
		: totalMessageCountPromise

	const [totalMessageCount, filteredMessageCount] = await Promise.all([
		totalMessageCountPromise,
		filteredMessageCountPromise,
	])

	const totalPages = Math.max(1, Math.ceil(filteredMessageCount / PAGE_SIZE))
	const currentPage = Math.min(page, totalPages)
	const pastMessages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true },
		orderBy: [{ sentAt: 'desc' }, { order: 'desc' }],
		take: PAGE_SIZE,
		skip: (currentPage - 1) * PAGE_SIZE,
	})

	const rangeStart =
		filteredMessageCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
	const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredMessageCount)

	return json({
		recipient,
		messageCount: totalMessageCount,
		messageCountDisplay: totalMessageCount.toLocaleString(),
		filteredMessageCount,
		filteredMessageCountDisplay: filteredMessageCount.toLocaleString(),
		searchTerm,
		pageInfo: {
			currentPage,
			totalPages,
			rangeStart,
			rangeEnd,
			pageSize: PAGE_SIZE,
		},
		pastMessages: pastMessages.map((message) => ({
			id: message.id,
			sentAtDisplay: message.sentAt!.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: 'numeric',
			}),
			content: message.content,
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
	const searchInputId = useId()
	const hasSearch = data.searchTerm.length > 0
	const hasMessages = data.filteredMessageCount > 0
	const messageResultLabel = hasSearch
		? data.filteredMessageCount === 1
			? 'matching message'
			: 'matching messages'
		: data.filteredMessageCount === 1
			? 'message'
			: 'messages'

	const buildPageLink = (page: number) => {
		const params = new URLSearchParams(searchParams)
		if (page <= 1) {
			params.delete('page')
		} else {
			params.set('page', String(page))
		}
		const query = params.toString()
		return query ? `?${query}` : '.'
	}

	const clearSearchParams = new URLSearchParams(searchParams)
	clearSearchParams.delete('search')
	clearSearchParams.delete('page')
	const clearSearchLink = clearSearchParams.toString()
		? `?${clearSearchParams.toString()}`
		: '.'

	return (
		<div className="flex flex-col gap-6">
			<p>
				You have sent <strong>{data.messageCountDisplay}</strong>{' '}
				{data.messageCount === 1 ? 'message' : 'messages'} to{' '}
				{data.recipient.name}.
			</p>
			<div className="flex flex-col gap-4">
				<Form method="GET" className="flex flex-wrap items-center gap-2">
					<div className="flex-1">
						<Label htmlFor={searchInputId} className="sr-only">
							Search messages
						</Label>
						<Input
							key={data.searchTerm}
							type="search"
							name="search"
							id={searchInputId}
							defaultValue={data.searchTerm}
							placeholder="Search messages"
							className="w-full"
						/>
					</div>
					<input type="hidden" name="page" value="1" />
					<Button type="submit" variant="secondary" size="sm">
						<Icon name="magnifying-glass" size="md" />
						<span className="sr-only">Search</span>
					</Button>
					{hasSearch ? (
						<Button variant="ghost" size="sm" asChild>
							<Link to={clearSearchLink} preventScrollReset>
								Clear search
							</Link>
						</Button>
					) : null}
				</Form>
				<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
					{hasMessages ? (
						<p>
							Showing {data.pageInfo.rangeStart}-
							{data.pageInfo.rangeEnd} of{' '}
							{data.filteredMessageCountDisplay} {messageResultLabel}
						</p>
					) : (
						<p>
							{hasSearch
								? 'No messages match this search.'
								: 'No messages have been sent yet.'}
						</p>
					)}
					{data.pageInfo.totalPages > 1 ? (
						<p>
							Page {data.pageInfo.currentPage} of{' '}
							{data.pageInfo.totalPages}
						</p>
					) : null}
				</div>
			</div>
			{hasMessages ? (
				<ul className="flex flex-col gap-2">
					{data.pastMessages.map((message) => (
						<li
							key={message.id}
							className="flex flex-col justify-start gap-2 align-top lg:flex-row"
						>
							<span className="min-w-36 text-muted-secondary-foreground">
								{message.sentAtDisplay}
							</span>
							<span>{message.content}</span>
						</li>
					))}
				</ul>
			) : null}
			{data.pageInfo.totalPages > 1 ? (
				<div className="flex flex-wrap items-center justify-center gap-2">
					{data.pageInfo.currentPage > 1 ? (
						<Button variant="outline" size="sm" asChild>
							<Link
								to={buildPageLink(data.pageInfo.currentPage - 1)}
								preventScrollReset
							>
								Previous
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Previous
						</Button>
					)}
					{data.pageInfo.currentPage < data.pageInfo.totalPages ? (
						<Button variant="outline" size="sm" asChild>
							<Link
								to={buildPageLink(data.pageInfo.currentPage + 1)}
								preventScrollReset
							>
								Next
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="sm" disabled>
							Next
						</Button>
					)}
				</div>
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
