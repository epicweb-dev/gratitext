/**
 * SCHEDULE SENTINEL DATES
 *
 * These sentinel values replace NULL for schedule fields, enabling efficient SQLite index usage.
 *
 * WHY NOT NULL?
 * The original cron query used `OR nextScheduledAt IS NULL` which defeats SQLite index usage,
 * causing full table scans (~259ms). By using sentinel dates instead of NULL:
 * - The query becomes a simple range check: `nextScheduledAt <= $cutoff`
 * - SQLite can use the composite index efficiently (single-digit ms)
 *
 * See: prisma/sql/getrecipientsforcron.sql for full performance documentation.
 */

/**
 * Sentinel date used when nextScheduledAt cannot be computed (invalid cron, etc.)
 * Using a far-future date (9999-12-31) means these recipients are naturally filtered out
 * by the `nextScheduledAt <= reminderCutoff` condition - no special handling needed.
 */
export const NEXT_SCHEDULE_SENTINEL_DATE = new Date('9999-12-31T23:59:59.999Z')

/**
 * Sentinel date used when prevScheduledAt cannot be computed (invalid cron, etc.)
 * Using a far-past date (1970-01-01) indicates there was never a valid previous schedule.
 */
export const PREV_SCHEDULE_SENTINEL_DATE = new Date('1970-01-01T00:00:00.000Z')

/**
 * @deprecated Use NEXT_SCHEDULE_SENTINEL_DATE instead
 */
export const SCHEDULE_SENTINEL_DATE = NEXT_SCHEDULE_SENTINEL_DATE
