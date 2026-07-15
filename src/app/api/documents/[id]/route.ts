import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, DOCUMENTS_BUCKET } from '@/lib/supabase';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.storagePath]);
  } catch {
    // The DB record is the source of truth for the app; a storage
    // object that fails to delete (e.g. Supabase unreachable) is an
    // orphan to clean up later, not a reason to block the user.
  }

  await prisma.document.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
