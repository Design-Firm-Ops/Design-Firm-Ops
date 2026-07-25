import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { leadUpdateSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/server/projectType';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data: payload, response } = await parseBody(req, leadUpdateSchema);
  if (response) return response;

  const { projectType, referralPartnerId, ...rest } = payload;
  const data: Record<string, unknown> = { ...rest };
  if (projectType !== undefined) data.projectTypeId = await findOrCreateProjectType(projectType, firmId);
  if (referralPartnerId !== undefined) data.referralPartnerId = referralPartnerId || null;

  const lead = await db.lead.update({ where: { id: params.id }, data });
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  await db.lead.delete({ where: { id: params.id } });
  return ok();
}
