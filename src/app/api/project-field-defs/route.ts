import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireAdmin, requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { projectFieldDefSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const defs = await db.projectFieldDef.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(defs);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, projectFieldDefSchema);
  if (response) return response;

  const def = await db.projectFieldDef.create({
    data: { ...data, firmId, order: await nextOrder(db.projectFieldDef) },
  });
  return NextResponse.json(def, { status: 201 });
}
