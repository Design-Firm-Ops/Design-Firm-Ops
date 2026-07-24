import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { projectFirmId } from '@/server/firm';
import { requireSession } from '@/server/apiAuth';
import { forbidden, parseBody } from '@/lib/apiRoute';
import { itemSchema } from '@/lib/validation';
import { resolvePermissions } from '@/server/permissions';
import { findOrCreateItemType } from '@/server/itemType';
import { nextItemTag } from '@/server/itemTag';
import { findOrCreateRoom } from '@/server/room';

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
      firmId: await projectFirmId(data.projectId),
    },
  });
  return NextResponse.json(item, { status: 201 });
}
