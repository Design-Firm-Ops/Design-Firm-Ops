import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok, parseBody } from '@/lib/apiRoute';
import { documentFolderUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, documentFolderUpdateSchema);
  if (response) return response;

  const existing = await db.projectDocumentFolder.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const { name, ...rest } = data;

  // Document.folder is free text, not a FK — renaming the folder means
  // repointing every document currently tagged with the old name too.
  const [folder] = await db.$transaction([
    db.projectDocumentFolder.update({ where: { id: params.id }, data: { ...rest, ...(name !== undefined ? { name } : {}) } }),
    ...(name !== undefined && name !== existing.name
      ? [db.document.updateMany({ where: { projectId: existing.projectId, folder: existing.name }, data: { folder: name } })]
      : []),
  ]);

  return NextResponse.json(folder);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const existing = await db.projectDocumentFolder.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  // Documents in a deleted folder move to Uncategorized rather than being deleted.
  await db.$transaction([
    db.document.updateMany({ where: { projectId: existing.projectId, folder: existing.name }, data: { folder: null } }),
    db.projectDocumentFolder.delete({ where: { id: params.id } }),
  ]);

  return ok();
}
