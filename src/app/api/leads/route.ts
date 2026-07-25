import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { leadSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/server/projectType';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const leads = await db.lead.findMany({
    include: { projectType: true, referralPartner: true },
    orderBy: { sortOrder: 'asc' },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, leadSchema);
  if (response) return response;

  const { projectType, referralPartnerId, ...rest } = data;
  const projectTypeId = await findOrCreateProjectType(projectType, firmId);

  const maxSort = await db.lead.aggregate({
    where: { pipelineStageId: data.pipelineStageId },
    _max: { sortOrder: true },
  });

  const lead = await db.lead.create({
    data: {
      ...rest,
      firmId,
      projectTypeId,
      referralPartnerId: referralPartnerId || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(lead, { status: 201 });
}
