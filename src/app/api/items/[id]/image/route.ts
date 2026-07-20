import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { getSupabaseServerClient, DOCUMENTS_BUCKET, ensureDocumentsBucket, createSignedDocumentUrl } from '@/lib/supabase';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, select: { imageStoragePath: true } });

  let storagePath: string;
  try {
    await ensureDocumentsBucket();
    const supabase = getSupabaseServerClient();
    const path = `items/${params.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) throw uploadError;
    storagePath = path;

    if (existing?.imageStoragePath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([existing.imageStoragePath]);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: `Storage upload failed: ${message}` }, { status: 502 });
  }

  const item = await prisma.item.update({ where: { id: params.id }, data: { imageStoragePath: storagePath } });
  const imageUrl = await createSignedDocumentUrl(storagePath);
  return NextResponse.json({ ...item, imageUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, select: { imageStoragePath: true } });
  if (existing?.imageStoragePath) {
    try {
      const supabase = getSupabaseServerClient();
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([existing.imageStoragePath]);
    } catch {
      // Orphaned storage object — DB is the source of truth for the app.
    }
  }

  await prisma.item.update({ where: { id: params.id }, data: { imageStoragePath: null } });
  return NextResponse.json({ ok: true });
}
