/*
  Warnings:

  - You are about to drop the `new_Recipient_optional` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `OptOut` will be added. If there are existing duplicate values, this will fail.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "new_Recipient_optional";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE UNIQUE INDEX "OptOut_phoneNumber_key" ON "OptOut"("phoneNumber");
