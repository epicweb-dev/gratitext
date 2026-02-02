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

/**
 * Check if a date is a sentinel value (meaning no valid schedule)
 */
export function isScheduleSentinel(date: Date | null): boolean {
	if (!date) return false
	return (
		date.getTime() === NEXT_SCHEDULE_SENTINEL_DATE.getTime() ||
		date.getTime() === PREV_SCHEDULE_SENTINEL_DATE.getTime()
	)
}

/**
 * Check if a nextScheduledAt date is the sentinel value
 */
export function isNextScheduleSentinel(date: Date | null): boolean {
	if (!date) return false
	return date.getTime() === NEXT_SCHEDULE_SENTINEL_DATE.getTime()
}

/**
 * Get the display value for a schedule date, returning null if it's the sentinel
 */
export function getScheduleDisplayDate(date: Date | null): Date | null {
	if (!date || isScheduleSentinel(date)) return null
	return date
}
