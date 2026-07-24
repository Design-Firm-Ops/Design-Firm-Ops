import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';

/** Items previously linked to this vendor, across all projects — lets a vendor's history follow it. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const items = await prisma.item.findMany({
    where: { vendorId: params.id },
    select: {
      id: true,
      tag: true,
      name: true,
      category: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
}
