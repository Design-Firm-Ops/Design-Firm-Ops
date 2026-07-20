import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';

const reorderSchema = z.object({
  order: z.array(z.string()).min(1),
});

export async function PATCH(req: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await Promise.all(
    parsed.data.order.map((id, index) => prisma.projectFieldDef.update({ where: { id }, data: { order: index } }))
  );

  return NextResponse.json({ ok: true });
}
