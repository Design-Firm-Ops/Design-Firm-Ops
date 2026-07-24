import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { forbidden, parseBody } from '@/lib/apiRoute';
import { designFeeChargeSchema } from '@/lib/validation';
import { resolvePermissions } from '@/server/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.financials) {
    return forbidden('You do not have permission to bill the design fee');
  }

  const { data, response } = await parseBody(req, designFeeChargeSchema);
  if (response) return response;

  const { date, ...rest } = data;
  const charge = await prisma.designFeeCharge.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
    },
  });
  return NextResponse.json(charge, { status: 201 });
}
