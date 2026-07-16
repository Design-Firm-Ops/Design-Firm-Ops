/*
  Warnings:

  - You are about to drop the column `repEmail` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `repName` on the `Vendor` table. All the data in the column will be lost.
  - You are about to drop the column `repPhone` on the `Vendor` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DESIGNER');

-- CreateEnum
CREATE TYPE "PaymentCategory" AS ENUM ('MERCHANDISE', 'DESIGN_FEE');

-- CreateEnum
CREATE TYPE "VendorAccountType" AS ENUM ('TRADE', 'RETAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "VendorProductType" AS ENUM ('STOCK', 'CUSTOM', 'BOTH');

-- CreateEnum
CREATE TYPE "VendorPriceRange" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "VendorOffering" AS ENUM ('FURNITURE', 'OUTDOOR', 'RUGS', 'PILLOWS', 'DECOR', 'MIRRORS', 'LAMPS', 'BEDDING');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "category" "PaymentCategory" NOT NULL DEFAULT 'MERCHANDISE';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "leadDesignerName" TEXT,
ADD COLUMN     "projectTypeId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "designerCanViewClientContact" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerCanViewContracts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerCanViewDocumentsPresentations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerCanViewFinancials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "designerCanViewInvoices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerCanViewProcurement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designerCanViewVendorCredentials" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'DESIGNER';

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "repEmail",
DROP COLUMN "repName",
DROP COLUMN "repPhone",
ADD COLUMN     "accountType" "VendorAccountType",
ADD COLUMN     "offerings" "VendorOffering"[],
ADD COLUMN     "priceRange" "VendorPriceRange",
ADD COLUMN     "productType" "VendorProductType",
ADD COLUMN     "showroomRep" TEXT,
ADD COLUMN     "tradeAccountNotes" TEXT,
ADD COLUMN     "tradeAccountPasswordEncrypted" TEXT,
ADD COLUMN     "tradeAccountUsername" TEXT;

-- CreateTable
CREATE TABLE "ProjectType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignFeeCharge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignFeeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "projectTypeId" TEXT,
    "referralSource" TEXT,
    "referralPartnerId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "pipelineStageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "convertedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_name_key" ON "ProjectType"("name");

-- CreateIndex
CREATE INDEX "DesignFeeCharge_projectId_idx" ON "DesignFeeCharge"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedProjectId_key" ON "Lead"("convertedProjectId");

-- CreateIndex
CREATE INDEX "Lead_pipelineStageId_idx" ON "Lead"("pipelineStageId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFeeCharge" ADD CONSTRAINT "DesignFeeCharge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_referralPartnerId_fkey" FOREIGN KEY ("referralPartnerId") REFERENCES "ReferralPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
