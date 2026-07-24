import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { offeringSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, offeringSchema.partial());
  if (response) return response;

  const offering = await prisma.offering.update({ where: { id: params.id }, data: data });
  return NextResponse.json(offering);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  await prisma.offering.delete({ where: { id: params.id } });
  return ok();
}
