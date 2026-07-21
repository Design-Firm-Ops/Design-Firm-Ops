import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { documentFolderUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = documentFolderUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.projectDocumentFolder.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { name, ...rest } = parsed.data;

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
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Documents in a deleted folder move to Uncategorized rather than being deleted.
  await prisma.$transaction([
    prisma.document.updateMany({ where: { projectId: existing.projectId, folder: existing.name }, data: { folder: null } }),
    prisma.projectDocumentFolder.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
