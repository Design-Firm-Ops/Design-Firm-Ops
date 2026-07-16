import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { referralPartnerSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = referralPartnerSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const partner = await prisma.referralPartner.update({ where: { id: params.id }, data: parsed.data });
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
  return NextResponse.json({ ok: true });
}
