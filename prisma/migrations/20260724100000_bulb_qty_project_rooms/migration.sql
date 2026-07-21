-- AlterTable
ALTER TABLE "Item" ADD COLUMN "bulbQty" INTEGER,
ALTER COLUMN "bulbIncluded" DROP NOT NULL,
ALTER COLUMN "bulbIncluded" DROP DEFAULT;

-- bulbIncluded was previously a plain boolean defaulting to false —
-- every existing row's "false" is really "never reviewed", not a
-- deliberate "no". Reset to NULL (not yet reviewed) so the new Bulbs
-- summary (see ItemsTable.tsx) doesn't treat untouched historical
-- items as confirmed bulb-not-included.
UPDATE "Item" SET "bulbIncluded" = NULL;

-- CreateTable
CREATE TABLE "ProjectRoom" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRoom_projectId_name_key" ON "ProjectRoom"("projectId", "name");

-- AddForeignKey
ALTER TABLE "ProjectRoom" ADD CONSTRAINT "ProjectRoom_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill room suggestions from whatever room names are already in
-- use on each project's items, so existing rooms show up in the new
-- dropdown immediately instead of the list starting empty.
INSERT INTO "ProjectRoom" ("id", "projectId", "name", "order")
SELECT
  'projectroom-' || md5(random()::text || clock_timestamp()::text || d."projectId" || d."room"),
  d."projectId",
  d."room",
  ROW_NUMBER() OVER (PARTITION BY d."projectId" ORDER BY d."room") - 1
FROM (
  SELECT DISTINCT "projectId", "room"
  FROM "Item"
  WHERE "room" IS NOT NULL AND "room" != ''
) d;
