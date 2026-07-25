import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { conflict, forbidden, notFound, ok } from '@/lib/apiRoute';
import { resolvePermissions } from '@/server/permissions';
import { isItemLocked, lockedChargeMessage } from '@/lib/itemLock';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const perms = await resolvePermissions(session);
  if (!perms.financials) {
    return forbidden('You do not have permission to modify the design fee');
  }

  const existing = await db.designFeeCharge.findUnique({
    where: { id: params.id },
    include: { invoice: { select: { invoiceNumber: true } } },
  });
  if (!existing) return notFound();
  if (isItemLocked(existing)) {
    return conflict(lockedChargeMessage(existing.invoice!.invoiceNumber));
  }

  await db.designFeeCharge.delete({ where: { id: params.id } });
  return ok();
}
