import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { leadUpdateSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/lib/projectType';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectType, referralPartnerId, ...rest } = parsed.data;
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
  return NextResponse.json({ ok: true });
}
