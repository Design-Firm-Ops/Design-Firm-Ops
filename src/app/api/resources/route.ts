import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { requireSession } from '@/server/apiAuth';
import { badRequest } from '@/lib/apiRoute';
import { storage, storagePath } from '@/server/storage';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  const folder = form.get('folder');

  if (!(file instanceof File) || typeof folder !== 'string' || !folder.trim()) {
    return badRequest('file and folder are required');
  }

  const path = storagePath(folder.trim(), file.name);
  try {
    await storage.upload('resources', path, await file.arrayBuffer(), { contentType: file.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const resource = await prisma.resource.create({
    data: {
      folder: folder.trim(),
      filename: file.name,
      storagePath: path,
      uploadedById: session!.user.id,
      firmId: await currentFirmId(),
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
