-- CreateTable
CREATE TABLE "RecipientJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "recipientId" TEXT NOT NULL,
  CONSTRAINT "RecipientJob_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipientJob_recipientId_key" ON "RecipientJob"("recipientId");

-- CreateIndex
CREATE INDEX "RecipientJob_runAt_idx" ON "RecipientJob"("runAt");
