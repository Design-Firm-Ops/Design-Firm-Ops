import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseServerClient, RESOURCES_BUCKET } from '@/lib/supabase';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const resource = await prisma.resource.findUnique({ where: { id: params.id } });
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const supabase = getSupabaseServerClient();
    await supabase.storage.from(RESOURCES_BUCKET).remove([resource.storagePath]);
  } catch {
    // Orphaned storage object is cleaned up later — not a reason to block deletion.
  }

  await prisma.resource.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
