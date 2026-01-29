import { remember } from '@epic-web/remember'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import chalk from 'chalk'
import { PrismaClient } from '#app/utils/prisma-generated.server/client.ts'

export const prisma = remember('prisma', () => {
	// NOTE: if you change anything in this function you'll need to restart
	// the dev server to see your changes.

	// Feel free to change this log threshold to something that makes sense for you
	const logThreshold = 20
	const url = process.env.DATABASE_URL
	if (!url) {
		throw new Error(
			'DATABASE_URL is required (expected a file: URL for SQLite).',
		)
	}

	const client = new PrismaClient({
		adapter: new PrismaBetterSqlite3({ url }),
		log: [
			{ level: 'query', emit: 'event' },
			{ level: 'error', emit: 'stdout' },
			{ level: 'warn', emit: 'stdout' },
		],
	})
	client.$on('query', async (e) => {
		if (e.duration < logThreshold) return
		const color =
			e.duration < logThreshold * 1.1
				? 'green'
				: e.duration < logThreshold * 1.2
					? 'blue'
					: e.duration < logThreshold * 1.3
						? 'yellow'
						: e.duration < logThreshold * 1.4
							? 'redBright'
							: 'red'
		const dur = chalk[color](`${e.duration}ms`)
		console.info(`prisma:query - ${dur} - ${e.query}`)
	})
	void client.$connect()
	return client
})
