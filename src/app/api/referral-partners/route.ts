import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { requireSession } from '@/server/apiAuth';
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

  const partner = await prisma.referralPartner.create({ data: { ...data, firmId: await currentFirmId() } });
  return NextResponse.json(partner, { status: 201 });
}
