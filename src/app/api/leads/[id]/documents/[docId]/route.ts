import type { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok } from '@/lib/apiRoute';
import { removeQuietly } from '@/server/storage';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.docId } });
  if (!document || document.leadId !== params.id) return notFound();

  await removeQuietly('documents', document.storagePath);

  await prisma.document.delete({ where: { id: params.docId } });
  return ok();
}
