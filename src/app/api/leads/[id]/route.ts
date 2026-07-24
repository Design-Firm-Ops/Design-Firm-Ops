import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { leadUpdateSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/lib/projectType';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data: payload, response } = await parseBody(req, leadUpdateSchema);
  if (response) return response;

  const { projectType, referralPartnerId, ...rest } = payload;
  const data: Record<string, unknown> = { ...rest };
  if (projectType !== undefined) data.projectTypeId = await findOrCreateProjectType(projectType);
  if (referralPartnerId !== undefined) data.referralPartnerId = referralPartnerId || null;

  const lead = await prisma.lead.update({ where: { id: params.id }, data });
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  await prisma.lead.delete({ where: { id: params.id } });
  return ok();
}
