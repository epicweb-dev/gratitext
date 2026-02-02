-- CreateIndex
CREATE INDEX "recipient_by_user" ON "Recipient"("userId", "id");

-- CreateIndex
CREATE INDEX "message_unsent_by_recipient" ON "Message"("recipientId")
WHERE "sentAt" IS NULL;
