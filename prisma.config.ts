import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts',
	},
	typedSql: {
		path: 'prisma/sql-generated',
	},
	datasource: {
		url: process.env.DATABASE_URL || 'file:./prisma/sqlite.db',
	},
})
