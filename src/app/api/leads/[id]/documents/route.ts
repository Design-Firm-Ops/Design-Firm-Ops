import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { badRequest } from '@/lib/apiRoute';
import { getSupabaseServerClient, DOCUMENTS_BUCKET, ensureDocumentsBucket, createSignedDocumentUrl } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const documents = await prisma.document.findMany({ where: { leadId: params.id }, orderBy: { uploadedAt: 'desc' } });
  const rows = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      url: await createSignedDocumentUrl(d.storagePath),
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

  let storagePath: string;
  try {
    await ensureDocumentsBucket();
    const supabase = getSupabaseServerClient();
    const path = `leads/${params.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) throw uploadError;

    storagePath = path;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const document = await prisma.document.create({
    data: { leadId: params.id, type: 'OTHER', filename: file.name, storagePath },
  });

  return NextResponse.json(document, { status: 201 });
}
