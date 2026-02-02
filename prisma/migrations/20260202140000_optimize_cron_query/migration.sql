-- Optimize the cron query by adding a composite index that matches the query pattern
-- This index covers: verified, disabled, nextScheduledAt (for range queries), and userId (for the join)

-- Drop existing less optimal indexes that will be superseded
DROP INDEX IF EXISTS "Recipient_verified_disabled_idx";
DROP INDEX IF EXISTS "Recipient_nextScheduledAt_idx";
DROP INDEX IF EXISTS "Recipient_userId_nextScheduledAt_idx";

-- Update NULL schedule values to sentinel dates
-- nextScheduledAt uses far-future date (9999-12-31) - will be filtered out by the query
-- prevScheduledAt uses far-past date (1970-01-01) - indicates no previous schedule
-- This eliminates the OR ... IS NULL pattern which defeats index usage in SQLite
UPDATE "Recipient" SET "nextScheduledAt" = '9999-12-31T23:59:59.999Z' WHERE "nextScheduledAt" IS NULL;
UPDATE "Recipient" SET "prevScheduledAt" = '1970-01-01T00:00:00.000Z' WHERE "prevScheduledAt" IS NULL;

-- Create optimized composite index for the cron query
-- Order: equality columns first (verified, disabled), then range column (nextScheduledAt), then join column (userId)
CREATE INDEX "Recipient_cron_query_idx" ON "Recipient"("verified", "disabled", "nextScheduledAt", "userId");

-- Create a partial index on User for stripeId IS NOT NULL - this helps the EXISTS subquery
CREATE INDEX "User_stripe_active_idx" ON "User"("id") WHERE "stripeId" IS NOT NULL;
