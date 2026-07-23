-- CreateEnum
CREATE TYPE "DimensionUnit" AS ENUM ('IN', 'CM');

-- Preserve the old freeform dimensions text before replacing it with
-- structured H x W x L fields.
ALTER TABLE "Item" ADD COLUMN "legacyDimensionsNote" TEXT;
UPDATE "Item" SET "legacyDimensionsNote" = "dimensions";
ALTER TABLE "Item" DROP COLUMN "dimensions";

-- AlterTable: new structured dimension/weight/lighting fields.
ALTER TABLE "Item" ADD COLUMN "dimensionHeight" DECIMAL(8,2),
ADD COLUMN "dimensionLength" DECIMAL(8,2),
ADD COLUMN "dimensionWidth" DECIMAL(8,2),
ADD COLUMN "dimensionUnit" "DimensionUnit" NOT NULL DEFAULT 'IN',
ADD COLUMN "weight" DECIMAL(8,2),
ADD COLUMN "bulbSpec" TEXT,
ADD COLUMN "bulbIncluded" BOOLEAN NOT NULL DEFAULT false;

-- Convert category from the fixed ItemCategory enum to free text
-- matching this project's Procurement list names, preserving every
-- existing item's category as a display-cased string rather than
-- losing it to a blind ::text cast of the ALL_CAPS enum label.
ALTER TABLE "Item" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "category" TYPE TEXT USING (
  CASE "category"::text
    WHEN 'LIGHTING' THEN 'Lighting'
    WHEN 'FURNITURE' THEN 'Furniture'
    WHEN 'PLUMBING' THEN 'Plumbing'
    WHEN 'HARDWARE' THEN 'Hardware'
    WHEN 'TEXTILES' THEN 'Textiles'
    WHEN 'ART' THEN 'Art'
    WHEN 'ACCESSORIES' THEN 'Accessories'
    WHEN 'APPLIANCES' THEN 'Appliances'
    WHEN 'OTHER' THEN 'Other Merchandise'
    ELSE "category"::text
  END
);
ALTER TABLE "Item" ALTER COLUMN "category" SET DEFAULT 'Other Merchandise';
DROP TYPE "ItemCategory";

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_offeringId_fkey";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "offeringId",
ADD COLUMN "itemTypeId" TEXT;

-- CreateTable
CREATE TABLE "ItemTypeOption" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagPrefix" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemTypeOption_category_name_key" ON "ItemTypeOption"("category", "name");

-- Seed the default item types described under Lighting and Furniture —
-- other categories start empty; users add their own via the item type
-- field (same find-or-create pattern as ProjectType/FeeStructureOption).
INSERT INTO "ItemTypeOption" ("id", "category", "name", "tagPrefix", "order") VALUES
  ('itemtype-lighting-chandelier', 'Lighting', 'Chandelier', 'CD', 0),
  ('itemtype-lighting-pendant', 'Lighting', 'Pendant', 'PD', 1),
  ('itemtype-lighting-sconce', 'Lighting', 'Sconce', 'SC', 2),
  ('itemtype-lighting-flushmount', 'Lighting', 'Flush Mount', 'FM', 3),
  ('itemtype-lighting-tablelamp', 'Lighting', 'Table Lamp', 'TL', 4),
  ('itemtype-lighting-floorlamp', 'Lighting', 'Floor Lamp', 'FL', 5),
  ('itemtype-furniture-sofa', 'Furniture', 'Sofa', 'SF', 0),
  ('itemtype-furniture-chair', 'Furniture', 'Chair', 'CH', 1),
  ('itemtype-furniture-table', 'Furniture', 'Table', 'TA', 2),
  ('itemtype-furniture-rug', 'Furniture', 'Rug', 'RG', 3),
  ('itemtype-furniture-bed', 'Furniture', 'Bed', 'BD', 4),
  ('itemtype-furniture-casegood', 'Furniture', 'Case Good', 'CG', 5),
  ('itemtype-furniture-ottoman', 'Furniture', 'Ottoman', 'OT', 6);

-- CreateIndex
CREATE INDEX "Item_itemTypeId_idx" ON "Item"("itemTypeId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ItemTypeOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "contactName" TEXT;

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
