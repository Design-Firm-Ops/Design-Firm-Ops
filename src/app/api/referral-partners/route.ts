import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { referralPartnerSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const partners = await prisma.referralPartner.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(partners);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = referralPartnerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const partner = await prisma.referralPartner.create({ data: parsed.data });
  return NextResponse.json(partner, { status: 201 });
}
