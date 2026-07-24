import type { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireAdmin } from '@/server/apiAuth';
import { applyOrder, ok, parseBody } from '@/lib/apiRoute';
import { reorderSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, reorderSchema);
  if (response) return response;

  await applyOrder(prisma.projectFieldDef, data.order);
  return ok();
}
