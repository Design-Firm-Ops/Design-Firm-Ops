-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "repName" TEXT,
ADD COLUMN     "repEmail" TEXT,
ADD COLUMN     "repPhone" TEXT,
ADD COLUMN     "showroomName" TEXT,
ADD COLUMN     "showroomAddress" TEXT;

-- Preserve existing showroom/rep text rather than discarding it — it
-- lands in showroomName verbatim so nothing is lost; admins can split
-- individual vendors into the new structured fields from the Vendors
-- page as needed.
UPDATE "Vendor" SET "showroomName" = "showroomRep" WHERE "showroomRep" IS NOT NULL;

ALTER TABLE "Vendor" DROP COLUMN "showroomRep";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "squareFootage" INTEGER,
ADD COLUMN     "estimatedBudget" DECIMAL(12,2),
ADD COLUMN     "timeline" TEXT,
ADD COLUMN     "builderName" TEXT,
ADD COLUMN     "architectName" TEXT;
