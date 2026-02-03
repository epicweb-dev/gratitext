-- Optimized cron query for fetching recipients due for reminders/messages
-- 
-- PERFORMANCE NOTES:
-- This query was optimized from ~259ms to single-digit ms by:
-- 1. Using INNER JOIN instead of LEFT JOIN (we filter on User.stripeId, so LEFT is unnecessary)
-- 2. Eliminating OR ... IS NULL by using sentinel dates (see schedule-constants.server.ts)
-- 3. Using composite index Recipient_cron_query_idx(verified, disabled, nextScheduledAt, userId)
-- 4. Reading denormalized lastSentAt directly instead of computing MAX(Message.sentAt)
--
-- WHY lastSentAt IS DENORMALIZED:
-- The original query computed MAX(Message.sentAt) via LEFT JOIN + GROUP BY, which was slow.
-- lastSentAt is now stored on Recipient and updated atomically when messages are sent.
-- DO NOT change this to compute from Message table - it would reintroduce the performance issue.
-- If data drifts, use: bun run backfill:recipient-schedules
--
-- WHY SENTINEL DATES:
-- NULL values for nextScheduledAt defeat SQLite index usage (OR ... IS NULL pattern).
-- Instead, invalid/missing schedules use NEXT_SCHEDULE_SENTINEL_DATE (9999-12-31),
-- which is always > $1 (reminderCutoff), so they're naturally filtered out.
--
-- @param {DateTime} $1 - The reminder cutoff time (now + 30 minutes)
SELECT
  r.id,
  r.name,
  r.scheduleCron,
  r.timeZone,
  r.prevScheduledAt,
  r.nextScheduledAt,
  r.lastRemindedAt,
  r.lastSentAt,
  u.phoneNumber AS userPhoneNumber,
  u.name AS userName
FROM Recipient r
INNER JOIN User u ON u.id = r.userId
WHERE r.verified = 1
  AND r.disabled = 0
  AND u.stripeId IS NOT NULL
  AND r.nextScheduledAt <= $1
ORDER BY r.nextScheduledAt ASC;
