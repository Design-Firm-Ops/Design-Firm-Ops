import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';

/**
 * Voids an invoice: status -> VOID, its items (or, for a Design Fee
 * Invoice, its charges) detach (invoiceId null) — items also revert to
 * APPROVED so they're available to re-invoice. The invoice row itself
 * is never deleted — it stays in the project's history for audit
 * purposes.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, designFeeCharges: true },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perms = await resolvePermissions(session);
  const allowed = invoice.type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return NextResponse.json({ error: 'You do not have permission to void this invoice' }, { status: 403 });
  }

  if (invoice.status === 'VOID') {
    return NextResponse.json({ error: 'This invoice is already voided' }, { status: 409 });
  }

  const itemIds = invoice.items.map((i) => i.id);
  const chargeIds = invoice.designFeeCharges.map((c) => c.id);

  const [updatedInvoice] = await prisma.$transaction([
    prisma.invoice.update({ where: { id: params.id }, data: { status: 'VOID' } }),
    prisma.item.updateMany({
      where: { id: { in: itemIds } },
      data: { invoiceId: null, status: 'APPROVED' },
    }),
    prisma.designFeeCharge.updateMany({
      where: { id: { in: chargeIds } },
      data: { invoiceId: null },
    }),
  ]);

  return NextResponse.json(updatedInvoice);
}
