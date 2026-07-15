import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { itemSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vendorId, ...rest } = parsed.data;

  const maxSort = await prisma.item.aggregate({
    where: { projectId: parsed.data.projectId },
    _max: { sortOrder: true },
  });

  const item = await prisma.item.create({
    data: {
      ...rest,
      vendorId: vendorId || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
