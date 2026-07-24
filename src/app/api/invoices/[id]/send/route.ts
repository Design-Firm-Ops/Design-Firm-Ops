import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { badRequest, conflict, forbidden, notFound } from '@/lib/apiRoute';
import { resolvePermissions } from '@/lib/permissions';
import { renderInvoicePdf } from '@/lib/pdf/renderInvoicePdf';
import { invoiceTotals } from '@/lib/financials';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/format';
import { sendInvoiceEmail } from '@/lib/email';

const DEFAULT_PRIMARY = '#4A3728';
const DEFAULT_ACCENT = '#C49A5C';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, designFeeCharges: true, project: { include: { client: true } } },
  });
  if (!invoice) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = invoice.type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to send this invoice');
  }

  if (invoice.status === 'VOID') {
    return conflict('This invoice has been voided and cannot be sent');
  }
  if (!invoice.project.client.email) {
    return badRequest('This client has no email on file — add one before sending');
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

  const totals = invoiceTotals(invoice, invoice.project);

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    await sendInvoiceEmail({
      to: invoice.project.client.email,
      clientName: invoice.project.client.name,
      companyName: settings?.companyName ?? 'Design Firm Ops',
      invoiceNumber: invoice.invoiceNumber,
      documentLabel: invoice.type === 'DESIGN_FEE' ? 'Design Fee Invoice' : 'Invoice',
      grandTotal: formatMoney(totals.grandTotal),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : null,
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
