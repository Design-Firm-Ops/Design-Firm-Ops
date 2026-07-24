import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { badRequest, forbidden, ok } from '@/lib/apiRoute';
import { resolvePermissions } from '@/server/permissions';
import { removeQuietly, storage, storagePath } from '@/server/storage';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return badRequest('file is required');
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, select: { imageStoragePath: true } });

  const path = storagePath(`items/${params.id}`, file.name);
  try {
    await storage.upload('documents', path, await file.arrayBuffer(), { contentType: file.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  // Only once the new image is safely stored does the old one go — a failed
  // replacement must not leave the item with no photo at all.
  await removeQuietly('documents', existing?.imageStoragePath);

  const item = await prisma.item.update({ where: { id: params.id }, data: { imageStoragePath: path } });
  const imageUrl = await storage.createSignedUrl('documents', path);
  return NextResponse.json({ ...item, imageUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, select: { imageStoragePath: true } });
  await removeQuietly('documents', existing?.imageStoragePath);

  await prisma.item.update({ where: { id: params.id }, data: { imageStoragePath: null } });
  return ok();
}
