import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { forbidden, notFound, parseBody } from '@/lib/apiRoute';
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
    return forbidden('You do not have permission to edit procurement');
  }

  const { data, response } = await parseBody(req, copySchema);
  if (response) return response;

  const source = await prisma.item.findUnique({ where: { id: params.id }, include: { fieldValues: true } });
  if (!source) return notFound();

  const maxSort = await prisma.item.aggregate({ where: { projectId: source.projectId }, _max: { sortOrder: true } });

  const copy = await prisma.item.create({
    data: {
      projectId: source.projectId,
      procurementListId: data.procurementListId,
      tag: source.tag,
      name: source.name,
      invoiceDisplayName: source.invoiceDisplayName,
      category: source.category,
      room: source.room,
      vendorId: source.vendorId,
      itemTypeId: source.itemTypeId,
      qty: source.qty,
      unitCost: source.unitCost,
      platformFee: source.platformFee,
      markupPct: source.markupPct,
      markupMode: source.markupMode,
      dimensionHeight: source.dimensionHeight,
      dimensionWidth: source.dimensionWidth,
      dimensionLength: source.dimensionLength,
      dimensionUnit: source.dimensionUnit,
      legacyDimensionsNote: source.legacyDimensionsNote,
      weight: source.weight,
      bulbSpec: source.bulbSpec,
      bulbIncluded: source.bulbIncluded,
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
