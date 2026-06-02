import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fsExtra from 'fs-extra'
import { prisma } from '#app/utils/db.server.ts'
import { setup as dbSetup } from './global-setup.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirPath = path.join(__dirname, '..', 'fixtures')
const defaultSourceNumber = '555-555-5555'

async function ensureSourceNumber() {
	const existingSourceNumber = await prisma.sourceNumber.findFirst({
		select: { id: true },
	})
	if (existingSourceNumber) return

	await prisma.sourceNumber.create({
		data: { phoneNumber: defaultSourceNumber },
		select: { id: true },
	})
}

/**
 * Playwright global setup - runs once before all tests
 * Cleans up fixtures directory to prevent stale data from previous runs
 */
export default async function globalSetup() {
	// Clean up fixtures directory to prevent stale mock data
	await fsExtra.emptyDir(fixturesDirPath)

	// Run database setup
	await dbSetup()
	await ensureSourceNumber()
	await prisma.$disconnect()

	console.log('✓ Playwright global setup complete')
}
