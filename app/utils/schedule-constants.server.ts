/**
 * Sentinel date used when nextScheduledAt cannot be computed (invalid cron, etc.)
 * Using a far-future date instead of NULL allows SQLite to use indexes efficiently
 * and eliminates the OR ... IS NULL pattern that defeats index usage.
 */
export const SCHEDULE_SENTINEL_DATE = new Date('9999-12-31T23:59:59.999Z')

/**
 * Check if a date is the sentinel value (meaning no valid schedule)
 */
export function isScheduleSentinel(date: Date | null): boolean {
	if (!date) return false
	return date.getTime() === SCHEDULE_SENTINEL_DATE.getTime()
}

/**
 * Get the display value for a schedule date, returning null if it's the sentinel
 */
export function getScheduleDisplayDate(date: Date | null): Date | null {
	if (!date || isScheduleSentinel(date)) return null
	return date
}
