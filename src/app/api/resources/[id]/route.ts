import type { NextRequest } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok } from '@/lib/apiRoute';
import { removeQuietly } from '@/server/storage';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const resource = await prisma.resource.findUnique({ where: { id: params.id } });
  if (!resource) return notFound();

  await removeQuietly('resources', resource.storagePath);

  await prisma.resource.delete({ where: { id: params.id } });
  return ok();
}
