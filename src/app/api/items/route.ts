import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { itemSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { findOrCreateItemType } from '@/lib/itemType';
import { nextItemTag } from '@/lib/itemTag';
import { findOrCreateRoom } from '@/lib/room';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { vendorId, itemType, procurementListId, tag, ...rest } = parsed.data;

  const itemTypeId = await findOrCreateItemType(parsed.data.category, itemType);
  if (rest.room) await findOrCreateRoom(parsed.data.projectId, rest.room);

  // A blank tag auto-fills from the item type's tag prefix — "TA-1"
  // for the first Table on this project, etc. A manually-typed tag is
  // always left as-is.
  const resolvedTag = tag?.trim() || (itemTypeId ? await nextItemTag(parsed.data.projectId, itemTypeId) : null) || '';

  const maxSort = await prisma.item.aggregate({
    where: { projectId: parsed.data.projectId },
    _max: { sortOrder: true },
  });

  const item = await prisma.item.create({
    data: {
      ...rest,
      tag: resolvedTag,
      vendorId: vendorId || null,
      itemTypeId,
      procurementListId: procurementListId || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
