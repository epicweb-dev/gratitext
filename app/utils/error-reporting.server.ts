import { isRouteErrorResponse } from 'react-router'

const reactRouterMethodNoise =
	/^(Error:\s*)?(Invalid request method "|You made a (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) request to ")/i

/**
 * Whether an error caught by the server `handleError` hook should be sent to
 * Sentry.
 *
 * React Router reports expected request outcomes (missing loader/action,
 * unsupported methods like OPTIONS, intentional thrown Responses) as
 * `RouteErrorResponse`s. Those are handled by route error boundaries and must
 * not be treated as unexpected failures — matching
 * `GeneralErrorBoundary` on the client.
 */
export function shouldReportToSentry(error: unknown): boolean {
	return !isRouteErrorResponse(error)
}

/**
 * Narrow match for React Router's getInternalRouterError messages that bots and
 * scanners trigger (unsupported method, missing loader/action). Used as a
 * beforeSend safety net.
 */
export function isReactRouterMethodNoiseMessage(message: string): boolean {
	return reactRouterMethodNoise.test(message)
}

type SentryExceptionLike = {
	exception?: {
		values?: Array<{ type?: string | null; value?: string | null }>
	}
}

export function shouldDropSentryEvent(event: SentryExceptionLike): boolean {
	const values = event.exception?.values ?? []
	return values.some((value) => {
		const message = value.value ?? ''
		return isReactRouterMethodNoiseMessage(message)
	})
}
