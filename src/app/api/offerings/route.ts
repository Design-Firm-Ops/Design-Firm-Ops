import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { offeringSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const offerings = await db.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  return NextResponse.json(offerings);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, offeringSchema);
  if (response) return response;

  const offering = await db.offering.create({
    data: { name: data.name, firmId, order: await nextOrder(db.offering, { firmId }) },
  });
  return NextResponse.json(offering, { status: 201 });
}
