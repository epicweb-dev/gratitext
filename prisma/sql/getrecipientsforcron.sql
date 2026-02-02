-- Optimized cron query for fetching recipients due for reminders/messages
-- Uses INNER JOIN instead of LEFT JOIN, and filters by nextScheduledAt range
-- The composite index Recipient_cron_query_idx covers this query pattern
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
