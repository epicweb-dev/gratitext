SELECT
  "Recipient"."id" AS "id",
  "Recipient"."name" AS "name",
  "Recipient"."scheduleCron" AS "scheduleCron",
  "Recipient"."timeZone" AS "timeZone",
  "Recipient"."lastRemindedAt" AS "lastRemindedAt",
  MAX("Message"."sentAt") AS "lastSentAt",
  "User"."phoneNumber" AS "userPhoneNumber",
  "User"."name" AS "userName"
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
  "Recipient"."name",
  "Recipient"."scheduleCron",
  "Recipient"."timeZone",
  "Recipient"."lastRemindedAt",
  "User"."phoneNumber",
  "User"."name";
