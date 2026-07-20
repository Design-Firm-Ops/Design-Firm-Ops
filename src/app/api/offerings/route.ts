import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
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

  const body = await req.json();
  const parsed = offeringSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.offering.aggregate({ _max: { order: true } });
  const offering = await prisma.offering.create({
    data: { name: parsed.data.name, order: (maxOrder._max.order ?? -1) + 1 },
  });
  return NextResponse.json(offering, { status: 201 });
}
