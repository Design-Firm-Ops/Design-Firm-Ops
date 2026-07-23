import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { itemTypeCreateSchema } from '@/lib/validation';
import { findOrCreateItemType } from '@/lib/itemType';

/** Explicitly adds a new item type under a category — same find-or-create as setting one inline on an item. */
export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = itemTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = await findOrCreateItemType(parsed.data.category, parsed.data.name);
  const itemType = await prisma.itemTypeOption.findUnique({ where: { id: id! } });
  return NextResponse.json(itemType, { status: 201 });
}
