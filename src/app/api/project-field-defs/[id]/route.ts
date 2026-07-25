import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { projectFieldDefUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, projectFieldDefUpdateSchema);
  if (response) return response;

  const def = await db.projectFieldDef.update({ where: { id: params.id }, data: data });
  return NextResponse.json(def);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  await db.projectFieldDef.delete({ where: { id: params.id } });
  return ok();
}
