-- Count unsent messages for a list of recipient IDs.
--
-- @param {String} $1 - JSON array of recipient ids
SELECT
  recipientId,
  CAST(COUNT(*) AS INTEGER) AS unsentCount
FROM Message INDEXED BY message_unsent_by_recipient
WHERE sentAt IS NULL
  AND recipientId IN (SELECT value FROM json_each($1))
GROUP BY recipientId;
