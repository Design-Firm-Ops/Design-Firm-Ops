import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { applyOrder, ok, parseBody } from '@/lib/apiRoute';
import { reorderSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, reorderSchema);
  if (response) return response;

  await applyOrder(prisma.pipelineStage, data.order);
  return ok();
}
