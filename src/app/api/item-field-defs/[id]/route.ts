import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { itemFieldDefUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, itemFieldDefUpdateSchema);
  if (response) return response;

  const def = await prisma.itemFieldDef.update({ where: { id: params.id }, data: data });
  return NextResponse.json(def);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  await prisma.itemFieldDef.delete({ where: { id: params.id } });
  return ok();
}
