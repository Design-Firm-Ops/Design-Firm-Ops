import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { procurementListUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = procurementListUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const list = await prisma.procurementList.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(list);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const itemCount = await prisma.item.count({ where: { procurementListId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this list has ${itemCount} line item(s). Move them first.` },
      { status: 409 }
    );
  }

  await prisma.procurementList.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
