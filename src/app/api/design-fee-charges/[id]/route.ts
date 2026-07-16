import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.financials) {
    return NextResponse.json({ error: 'You do not have permission to modify the design fee' }, { status: 403 });
  }

  await prisma.designFeeCharge.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
