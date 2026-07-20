-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'VOID';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "defaultInvoiceColumnConfig" JSONB;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "columnConfig" JSONB,
ADD COLUMN     "portalToken" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "invoiceAccentColor" TEXT,
ADD COLUMN     "invoicePrimaryColor" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_portalToken_key" ON "Invoice"("portalToken");
