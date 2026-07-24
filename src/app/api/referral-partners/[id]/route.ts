import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { referralPartnerSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, referralPartnerSchema.partial());
  if (response) return response;

  const partner = await prisma.referralPartner.update({ where: { id: params.id }, data: data });
  return NextResponse.json(partner);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const leadCount = await prisma.lead.count({ where: { referralPartnerId: params.id } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `This partner is linked to ${leadCount} lead(s). Unlink them first.` },
      { status: 409 }
    );
  }

  await prisma.referralPartner.delete({ where: { id: params.id } });
  return ok();
}
