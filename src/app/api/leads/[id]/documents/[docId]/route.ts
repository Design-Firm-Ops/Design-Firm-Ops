import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, DOCUMENTS_BUCKET } from '@/lib/supabase';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.docId } });
  if (!document || document.leadId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.storagePath]);
  } catch {
    // Orphaned storage object — DB is the source of truth for the app.
  }

  await prisma.document.delete({ where: { id: params.docId } });
  return NextResponse.json({ ok: true });
}
