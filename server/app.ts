import { createRequestHandler } from '@remix-run/express'
import { type ServerBuild } from '@remix-run/node'
import express from 'express'

declare module '@remix-run/server-runtime' {
	interface AppLoadContext {
		cspNonce?: string
		serverBuild: ServerBuild
	}
}

export const app = express()

app.use(
	createRequestHandler({
		mode: process.env.NODE_ENV ?? 'development',
		build: () => import('virtual:remix/server-build'),
		getLoadContext: async (_req, res) => ({
			cspNonce: res.locals.cspNonce,
			serverBuild: await import('virtual:remix/server-build'),
		}),
	}),
)