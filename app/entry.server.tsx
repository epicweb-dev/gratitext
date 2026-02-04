import { PassThrough } from 'stream'
import { createReadableStreamFromReadable } from '@react-router/node'
import * as Sentry from '@sentry/react-router'
import chalk from 'chalk'
import { isbot } from 'isbot'
import * as ReactDOMServer from 'react-dom/server'
import {
	type ActionFunctionArgs,
	type HandleDocumentRequestFunction,
	type LoaderFunctionArgs,
	ServerRouter,
} from 'react-router'
import { getSessionRenewal, sessionKey } from './utils/auth.server.ts'
import { init as initCron } from './utils/cron.server.ts'
import { getEnv, init as initEnv } from './utils/env.server.ts'
import { getInstanceInfo } from './utils/litefs.server.ts'
import { NonceProvider } from './utils/nonce-provider.ts'
import { authSessionStorage } from './utils/session.server.ts'
import { makeTimings } from './utils/timing.server.ts'

const ABORT_DELAY = 5000
const renderToPipeableStream = (
	ReactDOMServer as {
		renderToPipeableStream?: typeof import('react-dom/server').renderToPipeableStream
	}
).renderToPipeableStream
const renderToReadableStream = (
	ReactDOMServer as {
		renderToReadableStream?: (...args: any[]) => Promise<ReadableStream>
	}
).renderToReadableStream

initEnv()
global.ENV = getEnv()

void initCron()

type DocRequestArgs = Parameters<HandleDocumentRequestFunction>

/**
 * Handle session renewal by adding the appropriate cookie headers
 */
async function handleSessionRenewal(request: Request, headers: Headers) {
	const sessionRenewal = getSessionRenewal(request)
	if (sessionRenewal) {
		// Retrieve the existing session from the request instead of creating a new one
		const authSession = await authSessionStorage.getSession(
			request.headers.get('cookie'),
		)
		authSession.set(sessionKey, sessionRenewal.sessionId)

		// Commit the session with the new expiration date
		const cookieHeader = await authSessionStorage.commitSession(authSession, {
			expires: sessionRenewal.expirationDate,
		})

		// Add the session cookie to the response headers
		headers.append('set-cookie', cookieHeader)
	}
}

export default async function handleRequest(...args: DocRequestArgs) {
	const [
		request,
		responseStatusCode,
		responseHeaders,
		remixContext,
		loadContext,
	] = args
	const { currentInstance, primaryInstance } = await getInstanceInfo()
	responseHeaders.set('fly-region', process.env.FLY_REGION ?? 'unknown')
	responseHeaders.set('fly-app', process.env.FLY_APP_NAME ?? 'unknown')
	responseHeaders.set('fly-primary-instance', primaryInstance)
	responseHeaders.set('fly-instance', currentInstance)

	if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
		responseHeaders.append('Document-Policy', 'js-profiling')
	}

	// Handle session renewal for document requests
	await handleSessionRenewal(request, responseHeaders)

	const callbackName = isbot(request.headers.get('user-agent'))
		? 'onAllReady'
		: 'onShellReady'

	const nonce = loadContext.cspNonce?.toString() ?? ''
	if (renderToPipeableStream) {
		return new Promise((resolve, reject) => {
			let didError = false
			// NOTE: this timing will only include things that are rendered in the shell
			// and will not include suspended components and deferred loaders
			const timings = makeTimings('render', 'renderToPipeableStream')

			const { pipe, abort } = renderToPipeableStream(
				<NonceProvider value={nonce}>
					<ServerRouter context={remixContext} url={request.url} nonce={nonce} />
				</NonceProvider>,
				{
					[callbackName]: () => {
						const body = new PassThrough()
						responseHeaders.set('Content-Type', 'text/html')
						responseHeaders.append('Server-Timing', timings.toString())
						resolve(
							new Response(createReadableStreamFromReadable(body), {
								headers: responseHeaders,
								status: didError ? 500 : responseStatusCode,
							}),
						)
						pipe(body)
					},
					onShellError: (err: unknown) => {
						reject(err)
					},
					onError: () => {
						didError = true
					},
					nonce,
				},
			)

			setTimeout(abort, ABORT_DELAY)
		})
	}

	if (!renderToReadableStream) {
		throw new Error('No compatible React DOM server renderer found.')
	}

	let didError = false
	const timings = makeTimings('render', 'renderToReadableStream')
	const abortController = new AbortController()
	setTimeout(() => abortController.abort(), ABORT_DELAY)
	const body = await renderToReadableStream(
		<NonceProvider value={nonce}>
			<ServerRouter context={remixContext} url={request.url} nonce={nonce} />
		</NonceProvider>,
		{
			nonce,
			signal: abortController.signal,
			onError: () => {
				didError = true
			},
		},
	)

	if (callbackName === 'onAllReady' && 'allReady' in body) {
		await (body as ReadableStream & { allReady?: Promise<void> }).allReady
	}

	responseHeaders.set('Content-Type', 'text/html')
	responseHeaders.append('Server-Timing', timings.toString())
	return new Response(body, {
		headers: responseHeaders,
		status: didError ? 500 : responseStatusCode,
	})
}

export async function handleDataRequest(
	response: Response,
	{ request }: LoaderFunctionArgs | ActionFunctionArgs,
) {
	const { currentInstance, primaryInstance } = await getInstanceInfo()
	response.headers.set('fly-region', process.env.FLY_REGION ?? 'unknown')
	response.headers.set('fly-app', process.env.FLY_APP_NAME ?? 'unknown')
	response.headers.set('fly-primary-instance', primaryInstance)
	response.headers.set('fly-instance', currentInstance)

	// Handle session renewal for data requests
	await handleSessionRenewal(request, response.headers)

	return response
}

export function handleError(
	error: unknown,
	{ request }: LoaderFunctionArgs | ActionFunctionArgs,
): void {
	// Skip capturing if the request is aborted as docs suggest
	if (request.signal.aborted) {
		return
	}
	const requestContext = {
		url: request.url,
		method: request.method,
		headers: Object.fromEntries(request.headers),
	}
	if (error instanceof Error) {
		console.error(chalk.red(error.stack))
	} else {
		console.error(chalk.red(error))
	}
	Sentry.withScope((scope) => {
		scope.setContext('request', requestContext)
		Sentry.captureException(error)
	})
}
