import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { notFound, ok, parseBody } from '@/lib/apiRoute';
import { documentFolderUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, documentFolderUpdateSchema);
  if (response) return response;

  const existing = await prisma.projectDocumentFolder.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const { name, ...rest } = data;

  // Document.folder is free text, not a FK — renaming the folder means
  // repointing every document currently tagged with the old name too.
  const [folder] = await prisma.$transaction([
    prisma.projectDocumentFolder.update({ where: { id: params.id }, data: { ...rest, ...(name !== undefined ? { name } : {}) } }),
    ...(name !== undefined && name !== existing.name
      ? [prisma.document.updateMany({ where: { projectId: existing.projectId, folder: existing.name }, data: { folder: name } })]
      : []),
  ]);

  return NextResponse.json(folder);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const existing = await prisma.projectDocumentFolder.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  // Documents in a deleted folder move to Uncategorized rather than being deleted.
  await prisma.$transaction([
    prisma.document.updateMany({ where: { projectId: existing.projectId, folder: existing.name }, data: { folder: null } }),
    prisma.projectDocumentFolder.delete({ where: { id: params.id } }),
  ]);

  return ok();
}
