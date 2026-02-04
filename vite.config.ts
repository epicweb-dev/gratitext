import { reactRouter } from '@react-router/dev/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { glob } from 'glob'
import { defineConfig } from 'vite'

const MODE = process.env.NODE_ENV

export default defineConfig(async (config) => ({
	build: {
		cssMinify: MODE === 'production',

		rollupOptions: {
			input: config.isSsrBuild ? './server/app.ts' : undefined,
			external: [/node:.*/, /bun:.*/, 'stream', 'crypto', 'fsevents'],
		},

		assetsInlineLimit: (source: string) => {
			if (source.endsWith('sprite.svg')) {
				return false
			}
		},

		sourcemap: true,
	},
	server: {
		watch: {
			ignored: ['**/playwright-report/**'],
		},
	},
	plugins: [
		tailwindcss(),
		reactRouter(),
		process.env.SENTRY_AUTH_TOKEN
			? sentryVitePlugin({
					disable: MODE !== 'production',
					authToken: process.env.SENTRY_AUTH_TOKEN,
					org: process.env.SENTRY_ORG,
					project: process.env.SENTRY_PROJECT,
					release: {
						name: process.env.COMMIT_SHA,
						setCommits: {
							auto: true,
						},
					},
					sourcemaps: {
						filesToDeleteAfterUpload: await glob(['./build/**/*.map']),
					},
				})
			: null,
	],
}))
