import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { forbidden, parseBody } from '@/lib/apiRoute';
import { designFeeChargeSchema } from '@/lib/validation';
import { resolvePermissions } from '@/server/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const perms = await resolvePermissions(session);
  if (!perms.financials) {
    return forbidden('You do not have permission to bill the design fee');
  }

  const { data, response } = await parseBody(req, designFeeChargeSchema);
  if (response) return response;

  const { date, ...rest } = data;
  const charge = await db.designFeeCharge.create({
    data: {
      ...rest,
      firmId,
      date: date ? new Date(date) : new Date(),
    },
  });
  return NextResponse.json(charge, { status: 201 });
}
