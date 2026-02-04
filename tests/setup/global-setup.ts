import path from 'node:path'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'
import 'dotenv/config'
import '#app/utils/env.server.ts'
// Avoid loading bun:sqlite when Playwright runs under Node.
const shouldInitCache = typeof process.versions?.bun === 'string'

export const BASE_DATABASE_PATH = path.join(
	process.cwd(),
	`./tests/prisma/base.db`,
)

export async function setup() {
	if (shouldInitCache) {
		await import('#app/utils/cache.server.ts')
	}

	const databaseExists = await fsExtra.pathExists(BASE_DATABASE_PATH)

	if (databaseExists) {
		const databaseLastModifiedAt = (await fsExtra.stat(BASE_DATABASE_PATH))
			.mtime
		const prismaSchemaLastModifiedAt = (
			await fsExtra.stat('./prisma/schema.prisma')
		).mtime

		if (prismaSchemaLastModifiedAt < databaseLastModifiedAt) {
			return
		}
	}

	await fsExtra.remove(BASE_DATABASE_PATH)
	await execaCommand('bunx prisma migrate deploy', {
		stdio: 'inherit',
		env: {
			...process.env,
			DATABASE_URL: `file:${BASE_DATABASE_PATH}`,
			// Required consent for Prisma in automated/CI environments
			PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
		},
	})
}
