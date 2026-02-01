-- CreateIndex
CREATE INDEX "User_stripeId_idx" ON "User"("stripeId");

-- CreateIndex
CREATE INDEX "Recipient_verified_disabled_idx" ON "Recipient"("verified", "disabled");

-- CreateIndex
CREATE INDEX "Message_recipientId_sentAt_order_idx" ON "Message"("recipientId", "sentAt", "order");
