import path from 'node:path'
import Database from 'better-sqlite3'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'

export const BASE_DATABASE_PATH = path.join(
	process.cwd(),
	`./tests/prisma/base.db`,
)

function hasSeedData() {
	try {
		const db = new Database(BASE_DATABASE_PATH, { readonly: true })
		const row = db
			.prepare('select count(*) as count from "SourceNumber"')
			.get() as { count?: number }
		db.close()
		return Number(row?.count ?? 0) > 0
	} catch {
		return false
	}
}

export async function setup() {
	const databaseExists = await fsExtra.pathExists(BASE_DATABASE_PATH)

	if (databaseExists) {
		const databaseLastModifiedAt = (await fsExtra.stat(BASE_DATABASE_PATH))
			.mtime
		const prismaSchemaLastModifiedAt = (
			await fsExtra.stat('./prisma/schema.prisma')
		).mtime

		if (prismaSchemaLastModifiedAt < databaseLastModifiedAt && hasSeedData()) {
			return
		}
	}

	const prismaEnv = {
		...process.env,
		DATABASE_URL: `file:${BASE_DATABASE_PATH}`,
		// Required consent for Prisma in automated/CI environments
		PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
	}

	await execaCommand('npx prisma migrate reset --force', {
		stdio: 'inherit',
		env: prismaEnv,
	})

	await execaCommand('npx prisma db seed', {
		stdio: 'inherit',
		env: prismaEnv,
	})
}
