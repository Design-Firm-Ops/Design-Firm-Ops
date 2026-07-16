import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { designFeeChargeSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.financials) {
    return NextResponse.json({ error: 'You do not have permission to bill the design fee' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = designFeeChargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, ...rest } = parsed.data;
  const charge = await prisma.designFeeCharge.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
    },
  });
  return NextResponse.json(charge, { status: 201 });
}
