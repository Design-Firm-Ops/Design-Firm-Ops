import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, RESOURCES_BUCKET, ensureResourcesBucket } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const form = await req.formData();
  const file = form.get('file');
  const folder = form.get('folder');

  if (!(file instanceof File) || typeof folder !== 'string' || !folder.trim()) {
    return NextResponse.json({ error: 'file and folder are required' }, { status: 400 });
  }

  let storagePath: string;
  try {
    await ensureResourcesBucket();
    const supabase = getSupabaseServerClient();
    const path = `${folder.trim()}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(RESOURCES_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) throw uploadError;

    storagePath = path;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const resource = await prisma.resource.create({
    data: {
      folder: folder.trim(),
      filename: file.name,
      storagePath,
      uploadedById: session!.user.id,
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
