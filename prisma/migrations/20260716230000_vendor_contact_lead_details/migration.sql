/*
  Warnings:

  - You are about to drop the column `showroomRep` on the `Vendor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "showroomRep",
ADD COLUMN     "repName" TEXT,
ADD COLUMN     "repEmail" TEXT,
ADD COLUMN     "repPhone" TEXT,
ADD COLUMN     "showroomName" TEXT,
ADD COLUMN     "showroomAddress" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "squareFootage" INTEGER,
ADD COLUMN     "estimatedBudget" DECIMAL(12,2),
ADD COLUMN     "timeline" TEXT,
ADD COLUMN     "builderName" TEXT,
ADD COLUMN     "architectName" TEXT;
