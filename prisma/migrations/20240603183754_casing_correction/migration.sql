-- ChatGPT helped me with this one.
PRAGMA foreign_keys=OFF;

-- Create new table with the desired schema
CREATE TABLE "new_Recipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "scheduleCron" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "lastRemindedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data from old table to new table, including renaming the column
INSERT INTO "new_Recipient" ("id", "name", "phoneNumber", "verified", "scheduleCron", "timeZone", "lastRemindedAt", "createdAt", "updatedAt", "userId")
SELECT "id", "name", "phoneNumber", "verified", "scheduleCron", "timezone", "lastRemindedAt", "createdAt", "updatedAt", "userId"
FROM "Recipient";

-- Drop old table
DROP TABLE "Recipient";

-- Rename new table to the original table name
ALTER TABLE "new_Recipient" RENAME TO "Recipient";

-- Create the index
CREATE INDEX "Recipient_userId_idx" ON "Recipient"("userId");

PRAGMA foreign_key_check("Recipient");
PRAGMA foreign_keys=ON;
