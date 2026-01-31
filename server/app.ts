import { createRequestHandler } from '@react-router/express'
import express from 'express'
import { type ServerBuild } from 'react-router'

declare module 'react-router' {
	interface AppLoadContext {
		cspNonce?: string
		serverBuild: ServerBuild
	}

	interface LoaderFunctionArgs {
		context: AppLoadContext
	}

	interface ActionFunctionArgs {
		context: AppLoadContext
	}
}

export const app = express()

app.use(
	createRequestHandler({
		mode: process.env.NODE_ENV ?? 'development',
		build: () => import('virtual:react-router/server-build'),
		getLoadContext: async (_req, res) => ({
			cspNonce: res.locals.cspNonce,
			serverBuild: await import('virtual:react-router/server-build'),
		}),
	}),
)
