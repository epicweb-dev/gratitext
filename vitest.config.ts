/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const browserChannel = process.env.CI ? 'chrome' : undefined

export default defineConfig({
	plugins: [react()],
	css: { postcss: { plugins: [] } },
	build: {
		rollupOptions: {
			external: [/bun:.*/],
		},
	},
	test: {
		include: ['./app/**/*.test.browser.ts', './app/**/*.test.browser.tsx'],
		setupFiles: ['./tests/setup/setup-browser-env.ts'],
		restoreMocks: true,
		browser: {
			enabled: true,
			provider: playwright({
				launchOptions: { channel: browserChannel },
			}),
			instances: [{ browser: 'chromium' }],
			headless: true,
			ui: false,
		},
		coverage: {
			include: ['app/**/*.{ts,tsx}'],
		},
	},
})
