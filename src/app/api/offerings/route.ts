import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextOrder } from '@/lib/order';
import { requireSession } from '@/lib/apiAuth';
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

  const offering = await prisma.offering.create({
    data: { name: data.name, order: await nextOrder(prisma.offering) },
  });
  return NextResponse.json(offering, { status: 201 });
}
