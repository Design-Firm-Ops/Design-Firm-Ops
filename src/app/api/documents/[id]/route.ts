import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { forbidden, notFound, ok } from '@/lib/apiRoute';
import { getSupabaseServerClient, DOCUMENTS_BUCKET } from '@/lib/supabase';
import { resolvePermissions } from '@/lib/permissions';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = document.itemId
    ? perms.procurement
    : document.type === 'CONTRACT'
      ? perms.contracts
      : perms.documentsPresentations;
  if (!allowed) {
    return forbidden('You do not have permission to delete this');
  }

  try {
    const supabase = getSupabaseServerClient();
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.storagePath]);
  } catch {
    // The DB record is the source of truth for the app; a storage
    // object that fails to delete (e.g. Supabase unreachable) is an
    // orphan to clean up later, not a reason to block the user.
  }

  await prisma.document.delete({ where: { id: params.id } });
  return ok();
}
