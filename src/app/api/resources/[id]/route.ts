import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok } from '@/lib/apiRoute';
import { removeQuietly } from '@/server/storage';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const resource = await db.resource.findUnique({ where: { id: params.id } });
  if (!resource) return notFound();

  await removeQuietly('resources', resource.storagePath);

  await db.resource.delete({ where: { id: params.id } });
  return ok();
}
