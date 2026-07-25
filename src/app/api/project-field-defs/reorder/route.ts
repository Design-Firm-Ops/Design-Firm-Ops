import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { applyOrder, ok, parseBody } from '@/lib/apiRoute';
import { reorderSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, reorderSchema);
  if (response) return response;

  await applyOrder(db.projectFieldDef, data.order);
  return ok();
}
