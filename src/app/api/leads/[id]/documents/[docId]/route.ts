import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok } from '@/lib/apiRoute';
import { removeQuietly } from '@/server/storage';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const document = await db.document.findUnique({ where: { id: params.docId } });
  if (!document || document.leadId !== params.id) return notFound();

  await removeQuietly('documents', document.storagePath);

  await db.document.delete({ where: { id: params.docId } });
  return ok();
}
