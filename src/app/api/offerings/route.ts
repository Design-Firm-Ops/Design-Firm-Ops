import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { offeringSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const offerings = await prisma.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  return NextResponse.json(offerings);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, offeringSchema);
  if (response) return response;

  const firmId = await currentFirmId();
  const offering = await prisma.offering.create({
    data: { name: data.name, firmId, order: await nextOrder(prisma.offering, { firmId }) },
  });
  return NextResponse.json(offering, { status: 201 });
}
