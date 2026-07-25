import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { badRequest, parseBody } from '@/lib/apiRoute';
import { procurementListSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return badRequest('projectId is required');

  const lists = await db.procurementList.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, procurementListSchema);
  if (response) return response;

  const list = await db.procurementList.create({
    data: { ...data, firmId, order: await nextOrder(db.procurementList, { projectId: data.projectId }) },
  });
  return NextResponse.json(list, { status: 201 });
}
