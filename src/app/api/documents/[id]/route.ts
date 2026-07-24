import type { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { forbidden, notFound, ok } from '@/lib/apiRoute';
import { removeQuietly } from '@/server/storage';
import { resolvePermissions } from '@/server/permissions';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = document.itemId
    ? perms.procurement
    : document.type === 'CONTRACT'
      ? perms.contracts
      : perms.documentsPresentations;
  if (!allowed) {
    return forbidden('You do not have permission to delete this');
  }

  await removeQuietly('documents', document.storagePath);

  await prisma.document.delete({ where: { id: params.id } });
  return ok();
}
