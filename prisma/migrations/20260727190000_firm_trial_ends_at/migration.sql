-- When a firm's trial ends (DES-28).
--
-- Additive: one nullable column, then a backfill for firms already on a trial
-- so the banner has something to count down to. Idempotent — the backfill only
-- touches rows where the column is still null.

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- Existing trials get the standard length measured from when they were
-- created, which is what deriving it would have given them anyway. Keep this
-- in step with TRIAL_DAYS in src/lib/trial.ts.
UPDATE "Firm"
SET "trialEndsAt" = "createdAt" + INTERVAL '14 days'
WHERE "status" = 'TRIAL' AND "trialEndsAt" IS NULL;
