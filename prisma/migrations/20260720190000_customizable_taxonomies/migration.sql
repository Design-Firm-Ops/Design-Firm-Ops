-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'RICH_TEXT');

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offering_name_key" ON "Offering"("name");

-- Seed one Offering row per legacy VendorOffering enum value, using
-- fixed ids so the backfill below can reference them deterministically.
INSERT INTO "Offering" ("id", "name", "order") VALUES
  ('offering-furniture', 'Furniture', 0),
  ('offering-outdoor', 'Outdoor', 1),
  ('offering-rugs', 'Rugs', 2),
  ('offering-pillows', 'Pillows', 3),
  ('offering-decor', 'Decor', 4),
  ('offering-mirrors', 'Mirrors', 5),
  ('offering-lamps', 'Lamps', 6),
  ('offering-bedding', 'Bedding', 7);

-- CreateTable
CREATE TABLE "_OfferingToVendor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_OfferingToVendor_AB_unique" ON "_OfferingToVendor"("A", "B");

-- CreateIndex
CREATE INDEX "_OfferingToVendor_B_index" ON "_OfferingToVendor"("B");

-- AddForeignKey
ALTER TABLE "_OfferingToVendor" ADD CONSTRAINT "_OfferingToVendor_A_fkey" FOREIGN KEY ("A") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferingToVendor" ADD CONSTRAINT "_OfferingToVendor_B_fkey" FOREIGN KEY ("B") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every vendor's existing offering tags by mapping the old
-- enum array onto the new Offering join table before the column and
-- enum are dropped.
INSERT INTO "_OfferingToVendor" ("A", "B")
SELECT
  'offering-' || lower(off.val::text),
  v."id"
FROM "Vendor" v
CROSS JOIN LATERAL unnest(v."offerings") AS off(val);

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "offerings";

-- DropEnum
DROP TYPE "VendorOffering";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "imageStoragePath" TEXT,
ADD COLUMN     "offeringId" TEXT,
ADD COLUMN     "procurementListId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "folder" TEXT,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "leadId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProjectFieldDef" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL DEFAULT 'TEXT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToDesigner" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFieldValue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "value" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFieldValue_projectId_fieldDefId_key" ON "ProjectFieldValue"("projectId", "fieldDefId");

-- CreateTable
CREATE TABLE "ItemFieldDef" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL DEFAULT 'TEXT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibleToDesigner" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFieldValue" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "value" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemFieldValue_itemId_fieldDefId_key" ON "ItemFieldValue"("itemId", "fieldDefId");

-- CreateTable
CREATE TABLE "ProcurementList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementList_projectId_idx" ON "ProcurementList"("projectId");

-- Seed the 5 default Procurement sub-lists for every existing project
-- so nothing regresses for projects created before this feature — new
-- projects get the same defaults from application code going forward.
INSERT INTO "ProcurementList" ("id", "projectId", "name", "order")
SELECT 'proclist-' || p."id" || '-lighting', p."id", 'Lighting', 0 FROM "Project" p
UNION ALL
SELECT 'proclist-' || p."id" || '-furniture', p."id", 'Furniture', 1 FROM "Project" p
UNION ALL
SELECT 'proclist-' || p."id" || '-decor', p."id", 'Decor', 2 FROM "Project" p
UNION ALL
SELECT 'proclist-' || p."id" || '-materials', p."id", 'Materials', 3 FROM "Project" p
UNION ALL
SELECT 'proclist-' || p."id" || '-other', p."id", 'Other Merchandise', 4 FROM "Project" p;

-- Slot existing line items into the closest matching default list by
-- their current category, so the Procurement tab isn't suddenly a pile
-- of "unassigned" items after upgrade.
UPDATE "Item" i SET "procurementListId" = 'proclist-' || i."projectId" || '-lighting' WHERE i."category" = 'LIGHTING';
UPDATE "Item" i SET "procurementListId" = 'proclist-' || i."projectId" || '-furniture' WHERE i."category" = 'FURNITURE';
UPDATE "Item" i SET "procurementListId" = 'proclist-' || i."projectId" || '-decor' WHERE i."category" IN ('ART', 'ACCESSORIES');
UPDATE "Item" i SET "procurementListId" = 'proclist-' || i."projectId" || '-materials' WHERE i."category" IN ('PLUMBING', 'HARDWARE', 'TEXTILES', 'APPLIANCES');
UPDATE "Item" i SET "procurementListId" = 'proclist-' || i."projectId" || '-other' WHERE i."category" = 'OTHER';

-- CreateIndex
CREATE INDEX "Item_procurementListId_idx" ON "Item"("procurementListId");

-- CreateIndex
CREATE INDEX "Document_leadId_idx" ON "Document"("leadId");

-- CreateIndex
CREATE INDEX "Document_itemId_idx" ON "Document"("itemId");

-- CreateTable
CREATE TABLE "ResourceFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceFolder_name_key" ON "ResourceFolder"("name");

-- CreateTable
CREATE TABLE "LeadBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadBoard_pkey" PRIMARY KEY ("id")
);

-- Every existing PipelineStage needs to belong to a board — create one
-- default board and attach the current single pipeline to it, so
-- nothing about the existing kanban changes visually.
INSERT INTO "LeadBoard" ("id", "name", "order", "updatedAt")
VALUES ('leadboard-default', 'Leads', 0, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "PipelineStage" ADD COLUMN     "boardId" TEXT;

UPDATE "PipelineStage" SET "boardId" = 'leadboard-default' WHERE "boardId" IS NULL;

ALTER TABLE "PipelineStage" ALTER COLUMN "boardId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PipelineStage_boardId_idx" ON "PipelineStage"("boardId");

-- AddForeignKey
ALTER TABLE "ProjectFieldValue" ADD CONSTRAINT "ProjectFieldValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFieldValue" ADD CONSTRAINT "ProjectFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "ProjectFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFieldValue" ADD CONSTRAINT "ItemFieldValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFieldValue" ADD CONSTRAINT "ItemFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "ItemFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_procurementListId_fkey" FOREIGN KEY ("procurementListId") REFERENCES "ProcurementList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementList" ADD CONSTRAINT "ProcurementList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "LeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
