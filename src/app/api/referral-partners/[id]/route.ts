import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { referralPartnerSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, referralPartnerSchema.partial());
  if (response) return response;

  const partner = await db.referralPartner.update({ where: { id: params.id }, data: data });
  return NextResponse.json(partner);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const leadCount = await db.lead.count({ where: { referralPartnerId: params.id } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `This partner is linked to ${leadCount} lead(s). Unlink them first.` },
      { status: 409 }
    );
  }

  await db.referralPartner.delete({ where: { id: params.id } });
  return ok();
}
