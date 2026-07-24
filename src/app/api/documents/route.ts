import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { badRequest, forbidden } from '@/lib/apiRoute';
import { storage, storagePath } from '@/server/storage';
import { isDocumentType } from '@/lib/domain';
import { resolvePermissions } from '@/server/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  const projectId = form.get('projectId');
  const type = form.get('type');
  const folder = form.get('folder');
  const itemId = form.get('itemId');

  if (!(file instanceof File) || typeof projectId !== 'string' || typeof type !== 'string') {
    return badRequest('file, projectId and type are required');
  }
  if (!isDocumentType(type)) {
    return badRequest('Invalid document type');
  }

  const perms = await resolvePermissions(session);
  const allowed =
    typeof itemId === 'string' && itemId
      ? perms.procurement
      : type === 'CONTRACT'
        ? perms.contracts
        : perms.documentsPresentations;
  if (!allowed) {
    return forbidden('You do not have permission to upload here');
  }

  const path = storagePath(projectId, file.name);
  try {
    await storage.upload('documents', path, await file.arrayBuffer(), { contentType: file.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const document = await prisma.document.create({
    data: {
      projectId,
      type,
      filename: file.name,
      storagePath: path,
      folder: typeof folder === 'string' && folder ? folder : null,
      itemId: typeof itemId === 'string' && itemId ? itemId : null,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
