-- Add lastSentAt to Recipient
ALTER TABLE "Recipient" ADD COLUMN "lastSentAt" DATETIME;

-- Backfill lastSentAt using existing sent messages
UPDATE "Recipient"
SET "lastSentAt" = (
  SELECT MAX("sentAt")
  FROM "Message"
  WHERE "Message"."recipientId" = "Recipient"."id"
    AND "Message"."sentAt" IS NOT NULL
);
