import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { badRequest, forbidden, parseBody } from '@/lib/apiRoute';
import { resolvePermissions } from '@/lib/permissions';
import { isItemLocked } from '@/lib/itemLock';

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['delete', 'setStatus']),
  status: z.enum(['PROPOSED', 'APPROVED', 'INVOICED', 'ORDERED', 'RECEIVED', 'DELIVERED']).optional(),
});

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const { data, response } = await parseBody(req, bulkSchema);
  if (response) return response;

  const { ids, action, status } = data;

  // Bulk actions never carry an unlock override — invoiced items are
  // silently skipped rather than failing the whole batch, and the
  // caller is told how many were skipped so the table can flag them.
  const targets = await prisma.item.findMany({ where: { id: { in: ids } }, select: { id: true, invoiceId: true } });
  const editableIds = targets.filter((t) => !isItemLocked(t)).map((t) => t.id);
  const skipped = targets.length - editableIds.length;

  if (action === 'delete') {
    if (editableIds.length > 0) {
      await prisma.item.deleteMany({ where: { id: { in: editableIds } } });
    }
    return NextResponse.json({ ok: true, skipped });
  }

  if (action === 'setStatus') {
    if (!status) {
      return badRequest('status is required for setStatus');
    }
    if (editableIds.length > 0) {
      await prisma.item.updateMany({ where: { id: { in: editableIds } }, data: { status } });
    }
    return NextResponse.json({ ok: true, skipped });
  }

  return badRequest('Unknown action');
}
