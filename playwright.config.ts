import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

const PORT = process.env.PORT || '3000'

export default defineConfig({
	testDir: './tests/e2e',
	// Increase overall test timeout for complex flows
	timeout: 60 * 1000,
	expect: {
		// Increase expect timeout for slow renders
		timeout: 15 * 1000,
	},
	// Run tests in series in CI for better database isolation
	fullyParallel: !process.env.CI,
	forbidOnly: !!process.env.CI,
	// Increase retries for flaky test recovery
	retries: process.env.CI ? 3 : 1,
	// Single worker in CI for database isolation
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['html'], ['github']] : 'html',
	// Global setup to clean fixtures before test run
	globalSetup: './tests/setup/playwright-global-setup.ts',
	use: {
		baseURL: `http://localhost:${PORT}/`,
		// Capture trace on first retry for debugging
		trace: 'on-first-retry',
		// Screenshot on failure for debugging
		screenshot: 'only-on-failure',
		// Video on first retry to help debug flaky tests
		video: 'on-first-retry',
		// Increase action timeout for slow interactions
		actionTimeout: 15 * 1000,
		// Increase navigation timeout for slow page loads
		navigationTimeout: 30 * 1000,
	},

	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],

	webServer: {
		command: process.env.CI ? 'npm run start:mocks' : 'npm run dev',
		port: Number(PORT),
		reuseExistingServer: !process.env.CI,
		stdout: 'pipe',
		stderr: 'pipe',
		// Increase server startup timeout
		timeout: 120 * 1000,
		env: {
			PORT,
		},
	},
})
