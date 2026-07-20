import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
import { projectFieldDefUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = projectFieldDefUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const def = await prisma.projectFieldDef.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(def);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  await prisma.projectFieldDef.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
