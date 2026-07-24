import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { badRequest } from '@/lib/apiRoute';
import { storage, storagePath } from '@/server/storage';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const documents = await prisma.document.findMany({ where: { leadId: params.id }, orderBy: { uploadedAt: 'desc' } });
  const rows = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      url: await storage.createSignedUrl('documents', d.storagePath),
      uploadedAt: d.uploadedAt.toISOString(),
    }))
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return badRequest('file is required');
  }

  const path = storagePath(`leads/${params.id}`, file.name);
  try {
    await storage.upload('documents', path, await file.arrayBuffer(), { contentType: file.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const document = await prisma.document.create({
    data: { leadId: params.id, type: 'OTHER', filename: file.name, storagePath: path },
  });

  return NextResponse.json(document, { status: 201 });
}
