import { invariantResponse } from '@epic-web/invariant'
import {
	type MetaFunction,
	json,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, useLoaderData, useSearchParams } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button, ButtonLink } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

const pageSize = 100

export async function loader({ params, request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const rawSearchTerm = url.searchParams.get('search') ?? ''
	const searchTerm = rawSearchTerm.trim()
	const requestedPage = Number(url.searchParams.get('page') ?? '1')
	const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
		? requestedPage
		: 1

	const recipient = await prisma.recipient.findUnique({
		where: { id: params.recipientId, userId },
		select: {
			id: true,
			name: true,
			phoneNumber: true,
		},
	})

	invariantResponse(recipient, 'Not found', { status: 404 })

	const messageWhere = {
		recipientId: recipient.id,
		sentAt: { not: null },
		...(searchTerm ? { content: { contains: searchTerm } } : {}),
	}

	const [messageCount, filteredMessageCount] = await Promise.all([
		prisma.message.count({
			where: {
				recipientId: recipient.id,
				sentAt: { not: null },
			},
		}),
		prisma.message.count({ where: messageWhere }),
	])

	const pageCount = Math.ceil(filteredMessageCount / pageSize)
	const safePage = Math.min(currentPage, pageCount || 1)

	const messages = await prisma.message.findMany({
		where: messageWhere,
		select: { id: true, content: true, sentAt: true, order: true },
		orderBy: [{ sentAt: 'desc' }, { order: 'desc' }],
		take: pageSize,
		skip: (safePage - 1) * pageSize,
	})

	return json({
		recipient,
		messageCount,
		messageCountDisplay: messageCount.toLocaleString(),
		filteredMessageCount,
		filteredMessageCountDisplay: filteredMessageCount.toLocaleString(),
		pageCount,
		currentPage: safePage,
		pageSize,
		searchTerm,
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
	const searchValue = searchParams.get('search') ?? ''
	const pageCount = data.pageCount
	const currentPage = data.currentPage
	const hasPagination = pageCount > 1
	const rangeStart =
		data.filteredMessageCount === 0
			? 0
			: (currentPage - 1) * data.pageSize + 1
	const rangeEnd =
		data.filteredMessageCount === 0
			? 0
			: rangeStart + data.pastMessages.length - 1

	const getPageLink = (page: number) => {
		const params = new URLSearchParams()
		if (data.searchTerm) {
			params.set('search', data.searchTerm)
		}
		if (page > 1) {
			params.set('page', String(page))
		}
		const paramString = params.toString()
		return paramString ? `?${paramString}` : '.'
	}

	return (
		<div>
			<p className="mb-4">
				You have sent <strong>{data.messageCountDisplay}</strong>{' '}
				{data.messageCount === 1 ? 'message' : 'messages'} to{' '}
				{data.recipient.name}.
			</p>
			<Form method="get" className="mb-6 flex flex-col gap-3 sm:flex-row">
				<div className="flex-1">
					<Label htmlFor="search">Search past messages</Label>
					<Input
						type="search"
						name="search"
						id="search"
						defaultValue={searchValue}
						placeholder="Search message content"
					/>
				</div>
				<div className="flex items-end">
					<Button type="submit" className="flex items-center gap-2">
						<Icon name="magnifying-glass" size="sm" />
						<span>Search</span>
					</Button>
				</div>
			</Form>
			<div className="mb-4 text-sm text-muted-foreground">
				{data.filteredMessageCount === 0 ? (
					<p>
						{data.searchTerm
							? `No messages match "${data.searchTerm}".`
							: 'No past messages to display.'}
					</p>
				) : (
					<p>
						Showing {rangeStart}-{rangeEnd} of{' '}
						{data.filteredMessageCountDisplay}{' '}
						{data.searchTerm ? 'matching ' : ''}
						{data.filteredMessageCount === 1 ? 'message' : 'messages'}.
					</p>
				)}
			</div>
			<ul className="flex flex-col gap-2">
				{data.pastMessages.map((m) => (
					<li
						key={m.id}
						className="flex flex-col justify-start gap-2 align-top lg:flex-row"
					>
						<span className="min-w-36 text-muted-secondary-foreground">
							{m.sentAtDisplay}
						</span>
						<span>{m.content}</span>
					</li>
				))}
			</ul>
			{hasPagination ? (
				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
					<div className="text-muted-foreground">
						Page {currentPage} of {pageCount}
					</div>
					<div className="flex items-center gap-2">
						<ButtonLink
							variant="outline"
							size="sm"
							to={getPageLink(currentPage - 1)}
							aria-disabled={currentPage <= 1}
							tabIndex={currentPage <= 1 ? -1 : undefined}
							className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
						>
							<Icon name="arrow-left" size="sm">
								Previous
							</Icon>
						</ButtonLink>
						<ButtonLink
							variant="outline"
							size="sm"
							to={getPageLink(currentPage + 1)}
							aria-disabled={currentPage >= pageCount}
							tabIndex={currentPage >= pageCount ? -1 : undefined}
							className={
								currentPage >= pageCount ? 'pointer-events-none opacity-50' : ''
							}
						>
							<Icon name="arrow-right" size="sm">
								Next
							</Icon>
						</ButtonLink>
					</div>
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
