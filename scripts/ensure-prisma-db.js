import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const defaultDatabaseUrl = 'file:./prisma/sqlite.db'
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl

function getSqlitePath(url) {
	if (!url.startsWith('file:')) return null
	const rawPath = url.slice('file:'.length).split('?')[0]
	if (!rawPath) return null
	const decoded = decodeURIComponent(rawPath)
	return path.isAbsolute(decoded) ? decoded : path.resolve(process.cwd(), decoded)
}

async function isInitialized(dbPath) {
	try {
		const stat = await fs.stat(dbPath)
		return stat.size > 0
	} catch {
		return false
	}
}

function getPrismaBinary() {
	return process.platform === 'win32'
		? 'node_modules/.bin/prisma.cmd'
		: 'node_modules/.bin/prisma'
}

async function main() {
	const dbPath = getSqlitePath(databaseUrl)
	if (!dbPath) return

	await fs.mkdir(path.dirname(dbPath), { recursive: true })
	const initialized = await isInitialized(dbPath)
	if (initialized) return

	const result = spawnSync(getPrismaBinary(), ['migrate', 'deploy'], {
		stdio: 'inherit',
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
		},
	})

	if (result.status !== 0) {
		process.exitCode = result.status ?? 1
	}
}

main().catch((error) => {
	console.error('Failed to initialize database:', error)
	process.exitCode = 1
})
