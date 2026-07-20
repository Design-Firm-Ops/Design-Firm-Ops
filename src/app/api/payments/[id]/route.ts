import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { paymentUpdateSchema } from '@/lib/validation';
import { recalculateInvoiceStatus } from '@/lib/invoiceStatus';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const existing = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perms = await resolvePermissions(session);
  const allowed = existing.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return NextResponse.json({ error: 'You do not have permission to edit this payment' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = paymentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { invoiceId, date, ...rest } = parsed.data;
  const nextInvoiceId = invoiceId !== undefined ? invoiceId || null : existing.invoiceId;

  if (nextInvoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: nextInvoiceId }, select: { status: true } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'VOID') {
      return NextResponse.json({ error: 'This invoice has been voided — payments cannot be recorded against it' }, { status: 409 });
    }
  }

  const payment = await prisma.payment.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(invoiceId !== undefined ? { invoiceId: invoiceId || null } : {}),
      ...(date !== undefined ? { date: date ? new Date(date) : new Date() } : {}),
    },
  });

  // Recalculate both the old and new invoice if it moved between them.
  if (payment.category === 'MERCHANDISE') {
    if (existing.invoiceId) await recalculateInvoiceStatus(existing.invoiceId);
    if (payment.invoiceId && payment.invoiceId !== existing.invoiceId) await recalculateInvoiceStatus(payment.invoiceId);
  }

  return NextResponse.json(payment);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const perms = await resolvePermissions(session);
  const allowed = payment.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return NextResponse.json({ error: 'You do not have permission to delete this payment' }, { status: 403 });
  }

  await prisma.payment.delete({ where: { id: params.id } });

  if (payment.invoiceId && payment.category === 'MERCHANDISE') {
    await recalculateInvoiceStatus(payment.invoiceId);
  }

  return NextResponse.json({ ok: true });
}
