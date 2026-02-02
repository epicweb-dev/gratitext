/**
 * Sentinel date used when nextScheduledAt cannot be computed (invalid cron, etc.)
 * Using a far-future date instead of NULL allows SQLite to use indexes efficiently
 * and eliminates the OR ... IS NULL pattern that defeats index usage.
 */
export const NEXT_SCHEDULE_SENTINEL_DATE = new Date('9999-12-31T23:59:59.999Z')

/**
 * Sentinel date used when prevScheduledAt cannot be computed (invalid cron, etc.)
 * Using a far-past date indicates there was never a valid previous schedule.
 */
export const PREV_SCHEDULE_SENTINEL_DATE = new Date('1970-01-01T00:00:00.000Z')

/**
 * @deprecated Use NEXT_SCHEDULE_SENTINEL_DATE instead
 */
export const SCHEDULE_SENTINEL_DATE = NEXT_SCHEDULE_SENTINEL_DATE
