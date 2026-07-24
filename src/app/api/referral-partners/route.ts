import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { parseBody } from '@/lib/apiRoute';
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

  const { data, response } = await parseBody(req, referralPartnerSchema);
  if (response) return response;

  const partner = await prisma.referralPartner.create({ data: data });
  return NextResponse.json(partner, { status: 201 });
}
