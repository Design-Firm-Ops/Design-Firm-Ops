import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { paymentSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { recalculateInvoiceStatus } from '@/lib/invoiceStatus';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const perms = await resolvePermissions(session);
  const allowed = parsed.data.category === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return NextResponse.json({ error: 'You do not have permission to log this payment' }, { status: 403 });
  }

  const { invoiceId, date, ...rest } = parsed.data;

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.status === 'VOID') {
      return NextResponse.json({ error: 'This invoice has been voided — payments cannot be recorded against it' }, { status: 409 });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      ...rest,
      invoiceId: invoiceId || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  if (payment.invoiceId && payment.category === 'MERCHANDISE') {
    await recalculateInvoiceStatus(payment.invoiceId);
  }

  return NextResponse.json(payment, { status: 201 });
}
