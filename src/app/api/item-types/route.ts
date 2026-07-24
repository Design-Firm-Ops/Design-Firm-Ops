import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { forbidden, parseBody } from '@/lib/apiRoute';
import { resolvePermissions } from '@/server/permissions';
import { itemTypeCreateSchema } from '@/lib/validation';
import { findOrCreateItemType } from '@/server/itemType';

/** Explicitly adds a new item type under a category — same find-or-create as setting one inline on an item. */
export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return forbidden('You do not have permission to edit procurement');
  }

  const { data, response } = await parseBody(req, itemTypeCreateSchema);
  if (response) return response;

  const id = await findOrCreateItemType(data.category, data.name);
  const itemType = await prisma.itemTypeOption.findUnique({ where: { id: id! } });
  return NextResponse.json(itemType, { status: 201 });
}
