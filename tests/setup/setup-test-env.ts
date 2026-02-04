import path from 'node:path'
import { type spyOn as spyOnType } from 'bun:test'
import fsExtra from 'fs-extra'
import 'dotenv/config'

const workerId =
	process.env.BUN_TEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? '0'
const databaseFile = `./tests/prisma/data.${workerId}.db`
const cacheDatabaseFile = `./tests/prisma/cache.${workerId}.db`
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = `file:${path.join(process.cwd(), databaseFile)}`
process.env.CACHE_DATABASE_PATH = path.join(process.cwd(), cacheDatabaseFile)
const databasePath = path.join(process.cwd(), databaseFile)

await fsExtra.ensureDir(path.join(process.cwd(), 'tests/prisma'))
await import('#app/utils/env.server.ts')
const { BASE_DATABASE_PATH, setup } = await import('./global-setup.ts')
// we need these to be imported first 👆

await setup()
await fsExtra.copyFile(BASE_DATABASE_PATH, databasePath)
await import('./db-setup.ts')

const { afterEach, beforeEach, spyOn } = await import('bun:test')
const { server } = await import('#tests/mocks/index.ts')
await import('./custom-matchers.ts')

afterEach(() => server.resetHandlers())
export let consoleError: ReturnType<typeof spyOnType>

beforeEach(() => {
	const originalConsoleError = console.error
	consoleError = spyOn(console, 'error')
	consoleError.mockImplementation(
		(...args: Parameters<typeof console.error>) => {
			originalConsoleError(...args)
			throw new Error(
				'Console error was called. Call consoleError.mockImplementation(() => {}) if this is expected.',
			)
		},
	)
})
