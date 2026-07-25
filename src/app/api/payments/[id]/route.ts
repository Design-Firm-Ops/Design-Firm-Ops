import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { conflict, forbidden, notFound, ok, parseBody } from '@/lib/apiRoute';
import { resolvePermissions } from '@/server/permissions';
import { paymentUpdateSchema } from '@/lib/validation';
import { recalculateInvoiceStatus } from '@/server/invoiceStatus';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const existing = await db.payment.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = existing.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to edit this payment');
  }

  const { data, response } = await parseBody(req, paymentUpdateSchema);
  if (response) return response;

  const { invoiceId, date, ...rest } = data;
  const nextInvoiceId = invoiceId !== undefined ? invoiceId || null : existing.invoiceId;

  if (nextInvoiceId) {
    const invoice = await db.invoice.findUnique({ where: { id: nextInvoiceId }, select: { status: true } });
    if (!invoice) return notFound('Invoice not found');
    if (invoice.status === 'VOID') {
      return conflict('This invoice has been voided — payments cannot be recorded against it');
    }
  }

  const payment = await db.payment.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(invoiceId !== undefined ? { invoiceId: invoiceId || null } : {}),
      ...(date !== undefined ? { date: date ? new Date(date) : new Date() } : {}),
    },
  });

  // Recalculate both the old and new invoice if it moved between them.
  if (existing.invoiceId) await recalculateInvoiceStatus(existing.invoiceId);
  if (payment.invoiceId && payment.invoiceId !== existing.invoiceId) await recalculateInvoiceStatus(payment.invoiceId);

  return NextResponse.json(payment);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const payment = await db.payment.findUnique({ where: { id: params.id } });
  if (!payment) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = payment.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to delete this payment');
  }

  await db.payment.delete({ where: { id: params.id } });

  if (payment.invoiceId) {
    await recalculateInvoiceStatus(payment.invoiceId);
  }

  return ok();
}
