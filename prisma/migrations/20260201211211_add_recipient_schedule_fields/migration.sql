-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN "lastSentAt" DATETIME;
ALTER TABLE "Recipient" ADD COLUMN "nextScheduledAt" DATETIME;
ALTER TABLE "Recipient" ADD COLUMN "prevScheduledAt" DATETIME;

-- CreateIndex
CREATE INDEX "Recipient_nextScheduledAt_idx" ON "Recipient"("nextScheduledAt");

-- CreateIndex
CREATE INDEX "Recipient_userId_nextScheduledAt_idx" ON "Recipient"("userId", "nextScheduledAt");
