/// <reference types="vitest" />

import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	css: { postcss: { plugins: [] } },
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					include: ['./app/**/*.test.ts'],
					setupFiles: ['./tests/setup/setup-test-env.ts'],
					globalSetup: ['./tests/setup/global-setup.ts'],
					restoreMocks: true,
				},
			},
			{
				extends: true,
				test: {
					name: 'browser',
					include: ['./app/**/*.test.tsx'],
					setupFiles: ['./tests/setup/setup-browser-env.ts'],
					restoreMocks: true,
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }],
						headless: true,
						ui: false,
					},
				},
			},
		],
		coverage: {
			include: ['app/**/*.{ts,tsx}'],
		},
	},
})
