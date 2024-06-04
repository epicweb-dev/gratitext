/*
  Warnings:

  - A unique constraint covering the columns `[twilioId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN "twilioId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_twilioId_key" ON "Message"("twilioId");
