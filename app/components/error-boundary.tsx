import * as Sentry from '@sentry/react-router'
import { type ReactElement, useEffect } from 'react'
import {
	type ErrorResponse,
	isRouteErrorResponse,
	Link,
	useParams,
	useRouteError,
} from 'react-router'
import { getErrorMessage } from '#app/utils/misc.tsx'
import { Icon } from './ui/icon.tsx'

type StatusHandler = (info: {
	error: ErrorResponse
	params: Record<string, string | undefined>
}) => ReactElement | null

function statusTitle(status: number) {
	switch (status) {
		case 400:
			return 'That request did not look right'
		case 401:
			return 'Please log in to continue'
		case 403:
			return 'You are not allowed to do that'
		case 404:
			return 'We could not find that'
		case 429:
			return 'Slow down a little'
		default:
			return status >= 500
				? 'Something went wrong on our end'
				: 'Something went wrong'
	}
}

export function ErrorMessage({
	eyebrow,
	title,
	description,
}: {
	eyebrow?: string
	title: string
	description?: string | null
}) {
	return (
		<div className="flex flex-col items-center gap-3 text-center">
			{eyebrow ? (
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.3em] uppercase">
					{eyebrow}
				</p>
			) : null}
			<h1 className="text-foreground text-2xl font-bold sm:text-3xl">
				{title}
			</h1>
			{description ? (
				<p className="text-muted-foreground max-w-prose text-sm break-words sm:text-base">
					{description}
				</p>
			) : null}
			<Link
				to="/"
				className="text-foreground mt-3 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
			>
				<Icon name="arrow-left" size="sm" aria-hidden="true" />
				Back to home
			</Link>
		</div>
	)
}

export function GeneralErrorBoundary({
	defaultStatusHandler = ({ error }) => (
		<ErrorMessage
			eyebrow={`Error ${error.status}`}
			title={statusTitle(error.status)}
			description={
				typeof error.data === 'string' && error.data ? error.data : null
			}
		/>
	),
	statusHandlers,
	unexpectedErrorHandler = (error) => (
		<ErrorMessage
			eyebrow="Unexpected error"
			title="Something went wrong"
			description={getErrorMessage(error)}
		/>
	),
}: {
	defaultStatusHandler?: StatusHandler
	statusHandlers?: Record<number, StatusHandler>
	unexpectedErrorHandler?: (error: unknown) => ReactElement | null
}) {
	const error = useRouteError()
	useEffect(() => {
		if (!isRouteErrorResponse(error)) {
			Sentry.captureException(error)
		}
	}, [error])
	const params = useParams()

	if (typeof document !== 'undefined') {
		console.error(error)
	}

	return (
		<div className="container flex flex-1 items-center justify-center py-16 md:py-24">
			<div className="border-border bg-card text-foreground w-full max-w-xl rounded-[32px] border px-6 py-10 text-center shadow-sm sm:px-10">
				{isRouteErrorResponse(error)
					? (statusHandlers?.[error.status] ?? defaultStatusHandler)({
							error,
							params,
						})
					: unexpectedErrorHandler(error)}
			</div>
		</div>
	)
}
