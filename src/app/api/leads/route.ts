import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { leadSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/lib/projectType';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const leads = await prisma.lead.findMany({
    include: { projectType: true, referralPartner: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectType, referralPartnerId, ...rest } = parsed.data;
  const projectTypeId = await findOrCreateProjectType(projectType);

  const maxSort = await prisma.lead.aggregate({
    where: { pipelineStageId: parsed.data.pipelineStageId },
    _max: { sortOrder: true },
  });

  const lead = await prisma.lead.create({
    data: {
      ...rest,
      projectTypeId,
      referralPartnerId: referralPartnerId || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(lead, { status: 201 });
}
