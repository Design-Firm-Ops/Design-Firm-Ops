-- CreateEnum
CREATE TYPE "FeeStructureScope" AS ENUM ('DESIGN_FEE', 'PROCUREMENT');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PROCUREMENT', 'DESIGN_FEE');

-- CreateTable
CREATE TABLE "FeeStructureOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "FeeStructureScope" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeStructureOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureOption_scope_name_key" ON "FeeStructureOption"("scope", "name");

-- Seed the two Design Fee Structure defaults and three Procurement Fee
-- Structure defaults every project sees. Fixed ids so the backfill
-- below (and any future migration) can reference them deterministically.
INSERT INTO "FeeStructureOption" ("id", "name", "scope", "order") VALUES
  ('feestruct-design-fixed-fee', 'Fixed Fee', 'DESIGN_FEE', 0),
  ('feestruct-design-hourly', 'Hourly', 'DESIGN_FEE', 1),
  ('feestruct-procurement-cost-plus', 'Cost Plus', 'PROCUREMENT', 0),
  ('feestruct-procurement-fixed-fee', 'Fixed Fee', 'PROCUREMENT', 1),
  ('feestruct-procurement-hourly', 'Hourly', 'PROCUREMENT', 2);

-- Only add these as DESIGN_FEE options if a project actually used them
-- historically — keeps the two shipped defaults (Fixed Fee, Hourly) as
-- the only options a new project sees, while losing no existing data.
INSERT INTO "FeeStructureOption" ("id", "name", "scope", "order")
SELECT 'feestruct-design-cost-plus', 'Cost Plus', 'DESIGN_FEE', 2
WHERE EXISTS (SELECT 1 FROM "Project" WHERE "feeStructure" = 'COST_PLUS')
ON CONFLICT ("scope", "name") DO NOTHING;

INSERT INTO "FeeStructureOption" ("id", "name", "scope", "order")
SELECT 'feestruct-design-hybrid', 'Hybrid', 'DESIGN_FEE', 3
WHERE EXISTS (SELECT 1 FROM "Project" WHERE "feeStructure" = 'HYBRID')
ON CONFLICT ("scope", "name") DO NOTHING;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "designFeeStructureId" TEXT,
ADD COLUMN "procurementFeeStructureId" TEXT;

-- Backfill every project's old single feeStructure enum value onto the
-- new Design Fee Structure lookup (procurementFeeStructureId is a new,
-- previously nonexistent concept and is left null for existing projects).
UPDATE "Project" SET "designFeeStructureId" = CASE "feeStructure"
  WHEN 'FLAT_FEE' THEN 'feestruct-design-fixed-fee'
  WHEN 'HOURLY' THEN 'feestruct-design-hourly'
  WHEN 'COST_PLUS' THEN 'feestruct-design-cost-plus'
  WHEN 'HYBRID' THEN 'feestruct-design-hybrid'
END;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "feeStructure";

-- DropEnum
DROP TYPE "FeeStructure";

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_designFeeStructureId_fkey" FOREIGN KEY ("designFeeStructureId") REFERENCES "FeeStructureOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_procurementFeeStructureId_fkey" FOREIGN KEY ("procurementFeeStructureId") REFERENCES "FeeStructureOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "DesignFeeCharge" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "DesignFeeCharge_invoiceId_idx" ON "DesignFeeCharge"("invoiceId");

-- AddForeignKey
ALTER TABLE "DesignFeeCharge" ADD CONSTRAINT "DesignFeeCharge_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "type" "InvoiceType" NOT NULL DEFAULT 'PROCUREMENT';

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financials" BOOLEAN,
    "clientContact" BOOLEAN,
    "documentsPresentations" BOOLEAN,
    "contracts" BOOLEAN,
    "invoices" BOOLEAN,
    "procurement" BOOLEAN,
    "vendorCredentials" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_key" ON "UserPermissionOverride"("userId");

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
