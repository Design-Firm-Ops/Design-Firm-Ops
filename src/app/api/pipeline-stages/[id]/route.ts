import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { pipelineStageUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, pipelineStageUpdateSchema);
  if (response) return response;

  const stage = await db.pipelineStage.update({ where: { id: params.id }, data: data });
  return NextResponse.json(stage);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const leadCount = await db.lead.count({ where: { pipelineStageId: params.id } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `Move the ${leadCount} lead(s) in this column to another stage before deleting it.` },
      { status: 409 }
    );
  }

  await db.pipelineStage.delete({ where: { id: params.id } });
  return ok();
}
