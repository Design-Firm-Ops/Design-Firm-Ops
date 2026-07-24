import { prisma } from '@/server/prisma';
import type { InvoiceType } from '@/lib/domain';

/**
 * Generates the next invoice number for a project: "<prefix>-001",
 * "<prefix>-002", etc — or "<prefix>-DF-001" for a Design Fee Invoice,
 * numbered in its own sequence so the two invoice types never collide
 * or skip numbers against each other. Falls back to "INV" when the
 * project has no invoicePrefix set.
 */
export async function nextInvoiceNumber(
  projectId: string,
  invoicePrefix: string | null,
  type: InvoiceType = 'PROCUREMENT'
): Promise<string> {
  const prefix = invoicePrefix?.trim() || 'INV';
  const count = await prisma.invoice.count({ where: { projectId, type } });
  const sequence = String(count + 1).padStart(3, '0');
  return type === 'DESIGN_FEE' ? `${prefix}-DF-${sequence}` : `${prefix}-${sequence}`;
}
