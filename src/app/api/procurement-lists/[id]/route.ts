import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { procurementListUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, procurementListUpdateSchema);
  if (response) return response;

  const list = await db.procurementList.update({ where: { id: params.id }, data: data });
  return NextResponse.json(list);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const itemCount = await db.item.count({ where: { procurementListId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this list has ${itemCount} line item(s). Move them first.` },
      { status: 409 }
    );
  }

  await db.procurementList.delete({ where: { id: params.id } });
  return ok();
}
