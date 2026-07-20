import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { renderInvoicePdf } from '@/lib/pdf/renderInvoicePdf';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.invoices) {
    return NextResponse.json({ error: 'You do not have permission to view invoices' }, { status: 403 });
  }

  const result = await renderInvoicePdf(params.id);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.invoiceNumber}.pdf"`,
    },
  });
}
