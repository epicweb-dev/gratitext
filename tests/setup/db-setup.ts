import path from 'node:path'
import { afterAll, beforeEach } from 'bun:test'
import fsExtra from 'fs-extra'
import { prisma } from '#app/utils/db.server.ts'
import { cleanupDb } from '#tests/db-utils.ts'

const workerId =
	process.env.BUN_TEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? '0'
const databaseFile = `./tests/prisma/data.${workerId}.db`
const databasePath = path.join(process.cwd(), databaseFile)
process.env.DATABASE_URL = `file:${databasePath}`

const cacheDatabaseFile = `./tests/prisma/cache.${workerId}.db`
const cacheDatabasePath = path.join(process.cwd(), cacheDatabaseFile)
process.env.CACHE_DATABASE_PATH = cacheDatabasePath

beforeEach(async () => {
	await cleanupDb(prisma)
})

afterAll(async () => {
	await prisma.$disconnect()
	await fsExtra.remove(databasePath)
})
