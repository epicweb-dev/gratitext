import { describe, expect, test, vi } from 'vitest'
import {
	BULLMQ_SIDECAR_JOB,
	DEFAULT_SIDECAR_INTERVAL_MS,
	MIN_SIDECAR_INTERVAL_MS,
	createSidecarProcessor,
	getRedisConnectionOptionsFromUrl,
	getSidecarIntervalMs,
	getSidecarJobSchedulerConfig,
} from './bullmq-sidecar.server.ts'

describe('getSidecarIntervalMs', () => {
	test('returns default for invalid values', () => {
		const env: NodeJS.ProcessEnv = { CRON_SIDECAR_INTERVAL_MS: 'nope' }
		expect(getSidecarIntervalMs(env)).toBe(DEFAULT_SIDECAR_INTERVAL_MS)
	})

	test('enforces minimum interval', () => {
		const env: NodeJS.ProcessEnv = { CRON_SIDECAR_INTERVAL_MS: '250' }
		expect(getSidecarIntervalMs(env)).toBe(MIN_SIDECAR_INTERVAL_MS)
	})

	test('returns configured interval when valid', () => {
		const env: NodeJS.ProcessEnv = { CRON_SIDECAR_INTERVAL_MS: '2500' }
		expect(getSidecarIntervalMs(env)).toBe(2500)
	})
})

describe('getRedisConnectionOptionsFromUrl', () => {
	test('parses redis url with auth and db', () => {
		const options = getRedisConnectionOptionsFromUrl(
			'redis://user:pass@localhost:6380/2',
		)

		expect(options).toEqual({
			host: 'localhost',
			port: 6380,
			username: 'user',
			password: 'pass',
			db: 2,
			tls: undefined,
		})
	})

	test('parses rediss url with tls enabled', () => {
		const options = getRedisConnectionOptionsFromUrl('rediss://redis.local/0')

		expect(options).toMatchObject({
			host: 'redis.local',
			port: 6379,
			tls: {},
		})
	})

	test('rejects invalid protocols', () => {
		expect(() =>
			getRedisConnectionOptionsFromUrl('http://localhost:6379'),
		).toThrow('REDIS_URL must start with redis:// or rediss://')
	})
})

test('getSidecarJobSchedulerConfig returns expected payload', () => {
	const config = getSidecarJobSchedulerConfig(3200)

	expect(config.jobSchedulerId).toBe(BULLMQ_SIDECAR_JOB)
	expect(config.repeat).toEqual({ every: 3200 })
	expect(config.jobTemplate).toEqual({
		name: BULLMQ_SIDECAR_JOB,
		data: {},
		opts: {
			removeOnComplete: true,
			removeOnFail: { count: 50 },
		},
	})
})

test('createSidecarProcessor only runs on primary', async () => {
	const sendNextTexts = vi.fn()
	const getInstanceInfo = vi.fn().mockResolvedValue({ currentIsPrimary: false })
	const processor = createSidecarProcessor({
		getInstanceInfo,
		sendNextTexts,
	})

	await processor()
	expect(sendNextTexts).not.toHaveBeenCalled()

	getInstanceInfo.mockResolvedValue({ currentIsPrimary: true })
	await processor()
	expect(sendNextTexts).toHaveBeenCalledTimes(1)
})
