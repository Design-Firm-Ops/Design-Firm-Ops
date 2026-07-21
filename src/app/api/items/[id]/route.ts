import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { itemUpdateSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { isItemLocked, lockedItemMessage } from '@/lib/itemLock';
import { findOrCreateItemType } from '@/lib/itemType';
import { nextItemTag } from '@/lib/itemTag';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, include: { invoice: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { unlockOverride, vendorId, itemType, procurementListId, tag, ...rest } = parsed.data;

  if (isItemLocked(existing)) {
    if (!unlockOverride) {
      return NextResponse.json({ error: lockedItemMessage(existing.invoice!.invoiceNumber) }, { status: 409 });
    }
    if (!perms.invoices) {
      return NextResponse.json({ error: 'You do not have permission to correct an invoiced item' }, { status: 403 });
    }
  }

  const itemTypeId =
    itemType !== undefined ? await findOrCreateItemType(rest.category ?? existing.category, itemType) : undefined;

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
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const existing = await prisma.item.findUnique({ where: { id: params.id }, include: { invoice: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const unlockOverride = req.nextUrl.searchParams.get('unlockOverride') === 'true';

  if (isItemLocked(existing)) {
    if (!unlockOverride) {
      return NextResponse.json({ error: lockedItemMessage(existing.invoice!.invoiceNumber) }, { status: 409 });
    }
    if (!perms.invoices) {
      return NextResponse.json({ error: 'You do not have permission to correct an invoiced item' }, { status: 403 });
    }
  }

  await prisma.item.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
