import { expect, test } from 'bun:test'
import { isRouteErrorResponse } from 'react-router'
import {
	isReactRouterMethodNoiseMessage,
	shouldDropSentryEvent,
	shouldReportToSentry,
} from './error-reporting.server.ts'

test('reports unexpected Error instances', () => {
	expect(shouldReportToSentry(new Error('boom'))).toBe(true)
})

test('reports unknown non-route values', () => {
	expect(shouldReportToSentry('string failure')).toBe(true)
	expect(shouldReportToSentry(null)).toBe(true)
})

test('does not report React Router route error responses', () => {
	const missingAction = {
		status: 405,
		statusText: 'Method Not Allowed',
		internal: true,
		data: 'Error: You made a POST request to "/api/gql" but did not provide an `action` for route "routes/$", so there is no way to handle the request.',
		error: new Error(
			'You made a POST request to "/api/gql" but did not provide an `action` for route "routes/$", so there is no way to handle the request.',
		),
	}
	const invalidOptions = {
		status: 405,
		statusText: 'Method Not Allowed',
		internal: true,
		data: 'Error: Invalid request method "OPTIONS"',
		error: new Error('Invalid request method "OPTIONS"'),
	}
	const missingLoader = {
		status: 400,
		statusText: 'Bad Request',
		internal: true,
		data: 'Error: You made a GET request to "/resources/theme-switch" but did not provide a `loader` for route "routes/resources+/theme-switch", so there is no way to handle the request.',
		error: new Error(
			'You made a GET request to "/resources/theme-switch" but did not provide a `loader` for route "routes/resources+/theme-switch", so there is no way to handle the request.',
		),
	}
	const intentionalNotFound = {
		status: 404,
		statusText: 'Not Found',
		internal: false,
		data: 'Not found',
	}

	expect(isRouteErrorResponse(missingAction)).toBe(true)
	expect(isRouteErrorResponse(invalidOptions)).toBe(true)
	expect(isRouteErrorResponse(missingLoader)).toBe(true)
	expect(isRouteErrorResponse(intentionalNotFound)).toBe(true)

	expect(shouldReportToSentry(missingAction)).toBe(false)
	expect(shouldReportToSentry(invalidOptions)).toBe(false)
	expect(shouldReportToSentry(missingLoader)).toBe(false)
	expect(shouldReportToSentry(intentionalNotFound)).toBe(false)
})

test('matches React Router method-noise exception messages', () => {
	expect(
		isReactRouterMethodNoiseMessage('Invalid request method "OPTIONS"'),
	).toBe(true)
	expect(
		isReactRouterMethodNoiseMessage(
			'You made a POST request to "/api/gql" but did not provide an `action` for route "routes/$", so there is no way to handle the request.',
		),
	).toBe(true)
	expect(
		isReactRouterMethodNoiseMessage(
			'Error: You made a GET request to "/resources/theme-switch" but did not provide a `loader` for route "routes/resources+/theme-switch", so there is no way to handle the request.',
		),
	).toBe(true)
	expect(isReactRouterMethodNoiseMessage('PrismaClientKnownRequestError')).toBe(
		false,
	)
	expect(isReactRouterMethodNoiseMessage('Unexpected server failure')).toBe(
		false,
	)
})

test('drops Sentry events that only contain method-noise exceptions', () => {
	expect(
		shouldDropSentryEvent({
			exception: {
				values: [{ type: 'Error', value: 'Invalid request method "OPTIONS"' }],
			},
		}),
	).toBe(true)
	expect(
		shouldDropSentryEvent({
			exception: {
				values: [{ type: 'Error', value: 'database connection refused' }],
			},
		}),
	).toBe(false)
})
