import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';

/** Items previously linked to this vendor, across all projects — lets a vendor's history follow it. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const items = await db.item.findMany({
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
