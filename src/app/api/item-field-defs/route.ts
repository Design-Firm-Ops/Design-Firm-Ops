import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireAdmin, requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { itemFieldDefSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const defs = await db.itemFieldDef.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(defs);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, itemFieldDefSchema);
  if (response) return response;

  const def = await db.itemFieldDef.create({
    data: { ...data, firmId, order: await nextOrder(db.itemFieldDef) },
  });
  return NextResponse.json(def, { status: 201 });
}
