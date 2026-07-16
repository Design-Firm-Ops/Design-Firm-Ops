import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';

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
  return NextResponse.json({ ok: true });
}
