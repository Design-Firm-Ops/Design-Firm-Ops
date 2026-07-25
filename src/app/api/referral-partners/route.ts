import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { referralPartnerSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const partners = await db.referralPartner.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(partners);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, referralPartnerSchema);
  if (response) return response;

  const partner = await db.referralPartner.create({ data: { ...data, firmId: firmId } });
  return NextResponse.json(partner, { status: 201 });
}
