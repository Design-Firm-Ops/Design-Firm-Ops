import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { forbidden, parseBody } from '@/lib/apiRoute';
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
    return forbidden('You do not have permission to edit procurement');
  }

  const { data, response } = await parseBody(req, itemSchema);
  if (response) return response;

  const { vendorId, itemType, procurementListId, tag, ...rest } = data;

  const itemTypeId = await findOrCreateItemType(data.category, itemType);
  if (rest.room) await findOrCreateRoom(data.projectId, rest.room);

  // A blank tag auto-fills from the item type's tag prefix — "TA-1"
  // for the first Table on this project, etc. A manually-typed tag is
  // always left as-is.
  const resolvedTag = tag?.trim() || (itemTypeId ? await nextItemTag(data.projectId, itemTypeId) : null) || '';

  const maxSort = await prisma.item.aggregate({
    where: { projectId: data.projectId },
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
