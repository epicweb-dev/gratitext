import {
	type ErrorResponse,
	isRouteErrorResponse,
	useParams,
	useRouteError,
} from '@remix-run/react'
import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { getErrorMessage } from '#app/utils/misc.tsx'

type StatusHandler = (info: {
	error: ErrorResponse
	params: Record<string, string | undefined>
}) => JSX.Element | null

export function GeneralErrorBoundary({
	defaultStatusHandler = ({ error }) => (
		<p>
			{error.status} {error.data}
		</p>
	),
	statusHandlers,
	unexpectedErrorHandler = (error) => <p>{getErrorMessage(error)}</p>,
}: {
	defaultStatusHandler?: StatusHandler
	statusHandlers?: Record<number, StatusHandler>
	unexpectedErrorHandler?: (error: unknown) => JSX.Element | null
}) {
	const error = useRouteError()
	useEffect(() => {
		if (
			typeof document !== 'undefined' &&
			error instanceof Error &&
			!isRouteErrorResponse(error)
		) {
			Sentry.captureException(error, {
				mechanism: {
					type: 'react-router',
					handled: false,
				},
			})
		}
	}, [error])
	const params = useParams()

	if (typeof document !== 'undefined') {
		console.error(error)
	}

	return (
		<div className="container flex items-center justify-center p-20 text-h2">
			{isRouteErrorResponse(error)
				? (statusHandlers?.[error.status] ?? defaultStatusHandler)({
						error,
						params,
					})
				: unexpectedErrorHandler(error)}
		</div>
	)
}
