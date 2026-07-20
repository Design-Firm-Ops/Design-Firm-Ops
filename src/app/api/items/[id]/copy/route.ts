import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';

const copySchema = z.object({
  procurementListId: z.string().min(1),
});

/** Duplicates a line item — including its custom field values — into a different Procurement list. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.procurement) {
    return NextResponse.json({ error: 'You do not have permission to edit procurement' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = copySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const source = await prisma.item.findUnique({ where: { id: params.id }, include: { fieldValues: true } });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const maxSort = await prisma.item.aggregate({ where: { projectId: source.projectId }, _max: { sortOrder: true } });

  const copy = await prisma.item.create({
    data: {
      projectId: source.projectId,
      procurementListId: parsed.data.procurementListId,
      tag: source.tag,
      name: source.name,
      invoiceDisplayName: source.invoiceDisplayName,
      category: source.category,
      room: source.room,
      vendorId: source.vendorId,
      offeringId: source.offeringId,
      qty: source.qty,
      unitCost: source.unitCost,
      platformFee: source.platformFee,
      markupPct: source.markupPct,
      markupMode: source.markupMode,
      dimensions: source.dimensions,
      finish: source.finish,
      link: source.link,
      shippingNotes: source.shippingNotes,
      status: source.status,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      fieldValues: {
        create: source.fieldValues.map((v) => ({ fieldDefId: v.fieldDefId, value: v.value })),
      },
    },
    include: { fieldValues: true },
  });

  return NextResponse.json(copy, { status: 201 });
}
