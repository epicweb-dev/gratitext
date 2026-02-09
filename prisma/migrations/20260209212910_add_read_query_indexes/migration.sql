-- CreateIndex
CREATE INDEX "message_history_by_recipient" ON "Message"("recipientId", "sentAt", "id");

-- CreateIndex
CREATE INDEX "recipient_by_phone" ON "Recipient"("phoneNumber");
