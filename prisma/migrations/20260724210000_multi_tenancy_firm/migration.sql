-- Multi-tenancy foundation (DES-23).
--
-- Introduces the Firm tenant root, attaches every firm-owned row to it, and
-- converts the global uniques into per-firm composites.
--
-- DESTRUCTIVE-ADJACENT: this touches every table. It is written by hand rather
-- than generated because the ordering matters — each firmId is added nullable,
-- backfilled, and only then made NOT NULL. Doing it in one step fails on any
-- table that already has rows.
--
-- The backfill assumes everything existing belongs to ONE firm. That assumption
-- is stated explicitly here rather than left implicit.
--
-- Idempotent: every step is guarded, so re-running is a no-op.

-- ---------------------------------------------------------------------------
-- 1. Firm
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "FirmStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Firm" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "status"    "FirmStatus" NOT NULL DEFAULT 'TRIAL',
  "plan"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Firm_slug_key" ON "Firm"("slug");

-- The single tenant every existing row is adopted into. A fixed literal id
-- keeps this step idempotent and makes the backfill below deterministic.
INSERT INTO "Firm" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('firm_mdi_0000000000000000', 'Madison Ditton Interiors', 'madison-ditton-interiors', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Add firmId (nullable), backfill, then enforce NOT NULL
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  -- Tables that get a required firmId.
  required_tables TEXT[] := ARRAY[
    'Client', 'Project', 'Vendor', 'Offering', 'ProjectType', 'ItemTypeOption',
    'FeeStructureOption', 'ResourceFolder', 'Resource', 'LeadBoard',
    'ReferralPartner', 'Settings', 'Invoice', 'Item', 'Payment'
  ];
  t TEXT;
  firm_id CONSTANT TEXT := 'firm_mdi_0000000000000000';
BEGIN
  -- User is handled separately: its firmId stays nullable, because a
  -- SUPER_ADMIN is a platform operator belonging to no firm.
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firmId" TEXT;
  UPDATE "User" SET "firmId" = firm_id WHERE "firmId" IS NULL;

  FOREACH t IN ARRAY required_tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "firmId" TEXT', t);
    EXECUTE format('UPDATE %I SET "firmId" = %L WHERE "firmId" IS NULL', t, firm_id);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "firmId" SET NOT NULL', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Settings: drop the singleton shape (id INT DEFAULT 1 -> cuid TEXT)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Settings' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "Settings" ALTER COLUMN "id" DROP DEFAULT;
    ALTER TABLE "Settings" ALTER COLUMN "id" TYPE TEXT USING ('settings_' || "id"::TEXT);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Global uniques -> per-firm composites
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "Offering_name_key";
DROP INDEX IF EXISTS "ProjectType_name_key";
DROP INDEX IF EXISTS "ResourceFolder_name_key";
DROP INDEX IF EXISTS "ItemTypeOption_category_name_key";
DROP INDEX IF EXISTS "FeeStructureOption_scope_name_key";
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Offering_firmId_name_key" ON "Offering"("firmId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectType_firmId_name_key" ON "ProjectType"("firmId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceFolder_firmId_name_key" ON "ResourceFolder"("firmId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ItemTypeOption_firmId_category_name_key" ON "ItemTypeOption"("firmId", "category", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeStructureOption_firmId_scope_name_key" ON "FeeStructureOption"("firmId", "scope", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_firmId_invoiceNumber_key" ON "Invoice"("firmId", "invoiceNumber");

-- One Settings row per firm, replacing the old id=1 singleton.
CREATE UNIQUE INDEX IF NOT EXISTS "Settings_firmId_key" ON "Settings"("firmId");

-- Deliberately left globally unique:
--   User.email          — credentials login resolves a user without a firm in hand
--   Invoice.portalToken — a random secret, not a per-firm name
--   Lead.convertedProjectId — a FK to a globally unique project

-- ---------------------------------------------------------------------------
-- 5. Indexes and foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "User_firmId_idx" ON "User"("firmId");
CREATE INDEX IF NOT EXISTS "Client_firmId_idx" ON "Client"("firmId");
CREATE INDEX IF NOT EXISTS "Project_firmId_idx" ON "Project"("firmId");
CREATE INDEX IF NOT EXISTS "Vendor_firmId_idx" ON "Vendor"("firmId");
CREATE INDEX IF NOT EXISTS "Offering_firmId_idx" ON "Offering"("firmId");
CREATE INDEX IF NOT EXISTS "ProjectType_firmId_idx" ON "ProjectType"("firmId");
CREATE INDEX IF NOT EXISTS "ItemTypeOption_firmId_idx" ON "ItemTypeOption"("firmId");
CREATE INDEX IF NOT EXISTS "FeeStructureOption_firmId_idx" ON "FeeStructureOption"("firmId");
CREATE INDEX IF NOT EXISTS "ResourceFolder_firmId_idx" ON "ResourceFolder"("firmId");
CREATE INDEX IF NOT EXISTS "Resource_firmId_idx" ON "Resource"("firmId");
CREATE INDEX IF NOT EXISTS "LeadBoard_firmId_idx" ON "LeadBoard"("firmId");
CREATE INDEX IF NOT EXISTS "ReferralPartner_firmId_idx" ON "ReferralPartner"("firmId");
CREATE INDEX IF NOT EXISTS "Invoice_firmId_idx" ON "Invoice"("firmId");
CREATE INDEX IF NOT EXISTS "Item_firmId_idx" ON "Item"("firmId");
CREATE INDEX IF NOT EXISTS "Payment_firmId_idx" ON "Payment"("firmId");

DO $$
DECLARE
  fk_tables TEXT[] := ARRAY[
    'User', 'Client', 'Project', 'Vendor', 'Offering', 'ProjectType',
    'ItemTypeOption', 'FeeStructureOption', 'ResourceFolder', 'Resource',
    'LeadBoard', 'ReferralPartner', 'Settings', 'Invoice', 'Item', 'Payment'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY fk_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = t || '_firmId_fkey' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        t, t || '_firmId_fkey'
      );
    END IF;
  END LOOP;
END $$;
