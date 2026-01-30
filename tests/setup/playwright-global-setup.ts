import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fsExtra from 'fs-extra'
import { setup as dbSetup } from './global-setup.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirPath = path.join(__dirname, '..', 'fixtures')

/**
 * Playwright global setup - runs once before all tests
 * Cleans up fixtures directory to prevent stale data from previous runs
 */
export default async function globalSetup() {
	// Clean up fixtures directory to prevent stale mock data
	await fsExtra.emptyDir(fixturesDirPath)

	// Run database setup
	await dbSetup()

	console.log('✓ Playwright global setup complete')
}
