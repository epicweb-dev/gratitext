-- Custom migration by ChatGPT to make timezone required while migrating existing data to 'America/Denver'

-- Step 1: Create a new table with timezone as optional
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipient_optional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "scheduleCron" TEXT NOT NULL,
    "timezone" TEXT,
    "lastRemindedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: Copy the data from the old table to the new table
INSERT INTO "new_Recipient_optional" ("createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "updatedAt", "userId", "verified")
SELECT "createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "updatedAt", "userId", "verified"
FROM "Recipient";

-- Step 3: Update the timezone for existing recipients
UPDATE "new_Recipient_optional" SET "timezone" = 'America/Denver';

-- Step 4: Create another new table with timezone set to be NOT NULL
CREATE TABLE "new_Recipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "scheduleCron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "lastRemindedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 5: Copy the updated data from the intermediate table to the final table
INSERT INTO "new_Recipient" ("createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "updatedAt", "userId", "verified", "timezone")
SELECT "createdAt", "id", "lastRemindedAt", "name", "phoneNumber", "scheduleCron", "updatedAt", "userId", "verified", "timezone"
FROM "new_Recipient_optional";

-- Step 6: Replace the old table with the new one
DROP TABLE "Recipient";
ALTER TABLE "new_Recipient" RENAME TO "Recipient";
CREATE INDEX "Recipient_userId_idx" ON "Recipient"("userId");

PRAGMA foreign_key_check("Recipient");
PRAGMA foreign_keys=ON;
