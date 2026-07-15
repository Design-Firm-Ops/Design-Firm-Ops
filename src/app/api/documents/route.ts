import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, DOCUMENTS_BUCKET, ensureDocumentsBucket } from '@/lib/supabase';

const DOCUMENT_TYPES = ['PRESENTATION', 'VENDOR_INVOICE', 'CONTRACT', 'OTHER'] as const;

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  const projectId = form.get('projectId');
  const type = form.get('type');

  if (!(file instanceof File) || typeof projectId !== 'string' || typeof type !== 'string') {
    return NextResponse.json({ error: 'file, projectId and type are required' }, { status: 400 });
  }
  if (!DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
  }

  let storagePath: string;
  try {
    await ensureDocumentsBucket();
    const supabase = getSupabaseServerClient();
    const path = `${projectId}/${Date.now()}-${file.name}`;
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
    data: {
      projectId,
      type: type as (typeof DOCUMENT_TYPES)[number],
      filename: file.name,
      storagePath,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
