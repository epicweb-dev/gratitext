-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "scheduleCron" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "lastRemindedAt" DATETIME,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Recipient" ("createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "timeZone", "updatedAt", "userId", "verified") SELECT "createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "timeZone", "updatedAt", "userId", "verified" FROM "Recipient";
DROP TABLE "Recipient";
ALTER TABLE "new_Recipient" RENAME TO "Recipient";
CREATE INDEX "Recipient_userId_idx" ON "Recipient"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
