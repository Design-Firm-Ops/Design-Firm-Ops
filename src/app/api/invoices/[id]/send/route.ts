import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { renderInvoicePdf } from '@/lib/pdf/renderInvoicePdf';
import { computeInvoiceTotals, priceLine } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { sendInvoiceEmail } from '@/lib/email';

const DEFAULT_PRIMARY = '#4A3728';
const DEFAULT_ACCENT = '#C49A5C';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.invoices) {
    return NextResponse.json({ error: 'You do not have permission to send invoices' }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, project: { include: { client: true } } },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.status === 'VOID') {
    return NextResponse.json({ error: 'This invoice has been voided and cannot be sent' }, { status: 409 });
  }
  if (!invoice.project.client.email) {
    return NextResponse.json({ error: 'This client has no email on file — add one before sending' }, { status: 400 });
  }

  const portalToken = invoice.portalToken ?? crypto.randomBytes(24).toString('hex');
  const issuedDate = invoice.issuedDate ?? new Date();
  const status = invoice.status === 'DRAFT' ? 'SENT' : invoice.status;

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: { portalToken, issuedDate, status },
  });

  const pdf = await renderInvoicePdf(params.id);
  if (!pdf) return NextResponse.json({ error: 'Could not generate PDF' }, { status: 500 });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  const extendedPrices = invoice.items.map(
    (item) =>
      priceLine({
        ...item,
        projectDefaultMarkupPct: invoice.project.defaultMarkupPct,
        projectMarkupMode: invoice.project.markupMode,
      }).extended
  );
  const totals = computeInvoiceTotals({
    extendedPrices,
    shippingTotal: invoice.shippingTotal,
    taxRate: invoice.taxRate,
    taxBase: invoice.taxBase,
  });

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    await sendInvoiceEmail({
      to: invoice.project.client.email,
      clientName: invoice.project.client.name,
      companyName: settings?.companyName ?? 'Design Firm Ops',
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: formatMoney(totals.grandTotal),
      dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : null,
      portalUrl: `${appUrl}/portal/invoice/${portalToken}`,
      primaryColor: settings?.invoicePrimaryColor || DEFAULT_PRIMARY,
      accentColor: settings?.invoiceAccentColor || DEFAULT_ACCENT,
      pdfBuffer: pdf.buffer,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return NextResponse.json({ error: `Invoice saved but the email failed to send: ${message}` }, { status: 502 });
  }

  return NextResponse.json(updated);
}
