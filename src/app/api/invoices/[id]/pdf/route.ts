import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { forbidden, notFound } from '@/lib/apiRoute';
import { resolvePermissions } from '@/server/permissions';
import { renderInvoicePdf } from '@/server/pdf/renderInvoicePdf';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, select: { type: true } });
  if (!invoice) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = invoice.type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to view this invoice');
  }

  const result = await renderInvoicePdf(params.id);
  if (!result) return notFound();

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.invoiceNumber}.pdf"`,
    },
  });
}
