import { prisma } from '@/lib/prisma';

/**
 * Generates the next invoice number for a project: "<prefix>-001",
 * "<prefix>-002", etc. Falls back to "INV" when the project has no
 * invoicePrefix set.
 */
export async function nextInvoiceNumber(projectId: string, invoicePrefix: string | null): Promise<string> {
  const prefix = invoicePrefix?.trim() || 'INV';
  const count = await prisma.invoice.count({ where: { projectId } });
  const sequence = String(count + 1).padStart(3, '0');
  return `${prefix}-${sequence}`;
}
