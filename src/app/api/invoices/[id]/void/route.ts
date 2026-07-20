import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';

/**
 * Voids an invoice: status -> VOID, its items detach (invoiceId null)
 * and revert to APPROVED so they're available to re-invoice. The
 * invoice row itself is never deleted — it stays in the project's
 * history for audit purposes.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.invoices) {
    return NextResponse.json({ error: 'You do not have permission to void invoices' }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { items: true } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status === 'VOID') {
    return NextResponse.json({ error: 'This invoice is already voided' }, { status: 409 });
  }

  const itemIds = invoice.items.map((i) => i.id);

  const [updatedInvoice] = await prisma.$transaction([
    prisma.invoice.update({ where: { id: params.id }, data: { status: 'VOID' } }),
    prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: { invoiceId: null, status: 'APPROVED' },
    }),
  ]);

  return NextResponse.json(updatedInvoice);
}
