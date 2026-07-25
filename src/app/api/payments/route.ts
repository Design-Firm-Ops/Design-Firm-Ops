import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { conflict, forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { paymentSchema } from '@/lib/validation';
import { resolvePermissions } from '@/server/permissions';
import { recalculateInvoiceStatus } from '@/server/invoiceStatus';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, paymentSchema);
  if (response) return response;

  const perms = await resolvePermissions(session);
  const allowed = data.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to log this payment');
  }

  const { invoiceId, date, ...rest } = data;

  if (invoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } });
    if (!invoice) return notFound('Invoice not found');
    if (invoice.status === 'VOID') {
      return conflict('This invoice has been voided — payments cannot be recorded against it');
    }
  }

  const payment = await db.payment.create({
    data: {
      ...rest,
      invoiceId: invoiceId || null,
      date: date ? new Date(date) : new Date(),
      firmId: firmId,
    },
  });

  if (payment.invoiceId) {
    await recalculateInvoiceStatus(payment.invoiceId);
  }

  return NextResponse.json(payment, { status: 201 });
}
