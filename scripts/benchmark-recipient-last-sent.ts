import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { execaCommand } from 'execa'
import { createId } from '@paralleldrive/cuid2'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '#app/utils/prisma-generated.server/client.ts'

type BenchmarkResult = {
	label: string
	durationsMs: number[]
}

const userCount = Number(process.env.BENCH_USERS ?? 1000)
const recipientsPerUser = Number(process.env.BENCH_RECIPIENTS_PER_USER ?? 3)
const messagesPerRecipient = Number(process.env.BENCH_MESSAGES_PER_RECIPIENT ?? 20)
const runs = Number(process.env.BENCH_RUNS ?? 5)
const chunkSize = Number(process.env.BENCH_CHUNK_SIZE ?? 1000)

function assertPositiveInt(value: number, name: string) {
	if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
		throw new Error(`${name} must be a positive integer`)
	}
}

assertPositiveInt(userCount, 'BENCH_USERS')
assertPositiveInt(recipientsPerUser, 'BENCH_RECIPIENTS_PER_USER')
assertPositiveInt(messagesPerRecipient, 'BENCH_MESSAGES_PER_RECIPIENT')
assertPositiveInt(runs, 'BENCH_RUNS')
assertPositiveInt(chunkSize, 'BENCH_CHUNK_SIZE')

const totalRecipients = userCount * recipientsPerUser
const totalMessages = totalRecipients * messagesPerRecipient

function chunk<T>(values: T[], size: number) {
	const result: T[][] = []
	for (let i = 0; i < values.length; i += size) {
		result.push(values.slice(i, i + size))
	}
	return result
}

function summarize(durations: number[]) {
	const sorted = [...durations].sort((a, b) => a - b)
	const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length
	const median = sorted[Math.floor(sorted.length / 2)] ?? 0
	const p95Index = Math.min(
		sorted.length - 1,
		Math.floor(sorted.length * 0.95),
	)
	const p95 = sorted[p95Index] ?? 0
	return {
		avg: avg.toFixed(2),
		median: median.toFixed(2),
		p95: p95.toFixed(2),
		min: sorted[0]?.toFixed(2) ?? '0.00',
		max: sorted[sorted.length - 1]?.toFixed(2) ?? '0.00',
	}
}

async function runBenchmark(
	label: string,
	fn: () => Promise<unknown>,
): Promise<BenchmarkResult> {
	const durationsMs: number[] = []
	await fn()
	for (let i = 0; i < runs; i++) {
		const start = performance.now()
		await fn()
		durationsMs.push(performance.now() - start)
	}
	return { label, durationsMs }
}

async function main() {
	const databasePath = path.join(
		os.tmpdir(),
		`gratitext-benchmark-last-sent-${Date.now()}.db`,
	)
	const databaseUrl = `file:${databasePath}`

	await fs.rm(databasePath, { force: true })
	await execaCommand('npx prisma migrate deploy', {
		stdio: 'inherit',
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
		},
	})

	const prisma = new PrismaClient({
		adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
	})

	console.log(
		`Seeding ${userCount} users, ${totalRecipients} recipients, ${totalMessages} messages...`,
	)

	const users = Array.from({ length: userCount }, (_, index) => {
		const id = createId()
		return {
			id,
			username: `user_${index}`,
			phoneNumber: `+1555${String(index).padStart(7, '0')}`,
			name: `User ${index}`,
			stripeId: `stripe_${index}`,
		}
	})

	for (const batch of chunk(users, chunkSize)) {
		await prisma.user.createMany({ data: batch })
	}

	const recipients = users.flatMap((user, userIndex) =>
		Array.from({ length: recipientsPerUser }, (_, recIndex) => ({
			id: createId(),
			userId: user.id,
			name: `Recipient ${userIndex}-${recIndex}`,
			phoneNumber: `+1666${String(userIndex).padStart(4, '0')}${String(recIndex).padStart(3, '0')}`,
			verified: true,
			disabled: false,
			scheduleCron: '*/5 * * * *',
			timeZone: 'UTC',
		})),
	)

	for (const batch of chunk(recipients, chunkSize)) {
		await prisma.recipient.createMany({ data: batch })
	}

	const messageBatch: Array<{
		id: string
		content: string
		sentAt: Date | null
		order: number
		recipientId: string
	}> = []
	let messageIndex = 0

	for (const recipient of recipients) {
		for (let i = 0; i < messagesPerRecipient; i++) {
			const sentAt =
				i === messagesPerRecipient - 1
					? null
					: new Date(Date.now() - (i + 1) * 60_000)
			messageBatch.push({
				id: createId(),
				content: `Message ${messageIndex++}`,
				sentAt,
				order: i + 1,
				recipientId: recipient.id,
			})
			if (messageBatch.length >= chunkSize) {
				await prisma.message.createMany({ data: messageBatch })
				messageBatch.length = 0
			}
		}
	}
	if (messageBatch.length) {
		await prisma.message.createMany({ data: messageBatch })
	}

	const relationQuery = () =>
		prisma.recipient.findMany({
			where: {
				verified: true,
				disabled: false,
				user: { stripeId: { not: null } },
			},
			select: {
				id: true,
				scheduleCron: true,
				timeZone: true,
				lastRemindedAt: true,
				messages: {
					select: { sentAt: true },
					orderBy: { sentAt: 'desc' },
					take: 1,
				},
			},
		})

	const aggregateQuery = () =>
		prisma.$queryRaw`
			SELECT
				"Recipient"."id",
				"Recipient"."scheduleCron",
				"Recipient"."timeZone",
				"Recipient"."lastRemindedAt",
				MAX("Message"."sentAt") AS "lastSentAt"
			FROM "Recipient"
			JOIN "User"
				ON "User"."id" = "Recipient"."userId"
			LEFT JOIN "Message"
				ON "Message"."recipientId" = "Recipient"."id"
				AND "Message"."sentAt" IS NOT NULL
			WHERE "Recipient"."verified" = 1
				AND "Recipient"."disabled" = 0
				AND "User"."stripeId" IS NOT NULL
			GROUP BY
				"Recipient"."id",
				"Recipient"."scheduleCron",
				"Recipient"."timeZone",
				"Recipient"."lastRemindedAt"
		`

	const results = await Promise.all([
		runBenchmark('relation take 1', relationQuery),
		runBenchmark('aggregate MAX(sentAt)', aggregateQuery),
	])

	const summaries = results.map((result) => ({
		label: result.label,
		...summarize(result.durationsMs),
	}))

	console.log('\nBenchmark results (ms):')
	console.table(summaries)

	await prisma.$disconnect()
	await fs.rm(databasePath, { force: true })
}

main().catch((error) => {
	console.error('Benchmark failed:', error)
	process.exitCode = 1
})
