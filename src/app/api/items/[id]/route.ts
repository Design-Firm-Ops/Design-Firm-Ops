import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { conflict, forbidden, notFound, ok, parseBody } from '@/lib/apiRoute';
import { itemUpdateSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { isItemLocked, lockedItemMessage } from '@/lib/itemLock';
import { findOrCreateItemType } from '@/lib/itemType';
import { nextItemTag } from '@/lib/itemTag';
import { findOrCreateRoom } from '@/lib/room';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const { data, response } = await parseBody(req, itemUpdateSchema);
  if (response) return response;

  const existing = await prisma.item.findUnique({ where: { id: params.id }, include: { invoice: true } });
  if (!existing) return notFound();

  const { unlockOverride, vendorId, itemType, procurementListId, tag, ...rest } = data;

  if (isItemLocked(existing)) {
    if (!unlockOverride) {
      return conflict(lockedItemMessage(existing.invoice!.invoiceNumber));
    }
    if (!perms.invoices) {
      return forbidden('You do not have permission to correct an invoiced item');
    }
  }

  const itemTypeId =
    itemType !== undefined ? await findOrCreateItemType(rest.category ?? existing.category, itemType) : undefined;

  if (rest.room) await findOrCreateRoom(existing.projectId, rest.room);

  // A blank tag auto-fills the moment an item type is set — matches
  // the same rule as item creation — but never overwrites a tag
  // that's already been typed in.
  const resolvedTag =
    tag !== undefined
      ? tag
      : itemTypeId && !existing.tag
        ? (await nextItemTag(existing.projectId, itemTypeId)) ?? undefined
        : undefined;

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
      ...(itemTypeId !== undefined ? { itemTypeId } : {}),
      ...(procurementListId !== undefined ? { procurementListId: procurementListId || null } : {}),
      ...(resolvedTag !== undefined ? { tag: resolvedTag } : {}),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, include: { invoice: true } });
  if (!existing) return notFound();

  const unlockOverride = req.nextUrl.searchParams.get('unlockOverride') === 'true';

  if (isItemLocked(existing)) {
    if (!unlockOverride) {
      return conflict(lockedItemMessage(existing.invoice!.invoiceNumber));
    }
    if (!perms.invoices) {
      return forbidden('You do not have permission to correct an invoiced item');
    }
  }

  await prisma.item.delete({ where: { id: params.id } });
  return ok();
}
