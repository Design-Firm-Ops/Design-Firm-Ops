import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { itemUpdateSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vendorId, ...rest } = parsed.data;

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  await prisma.item.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
