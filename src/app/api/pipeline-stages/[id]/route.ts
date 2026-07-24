import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { ok, parseBody } from '@/lib/apiRoute';
import { pipelineStageUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, pipelineStageUpdateSchema);
  if (response) return response;

  const stage = await prisma.pipelineStage.update({ where: { id: params.id }, data: data });
  return NextResponse.json(stage);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const leadCount = await prisma.lead.count({ where: { pipelineStageId: params.id } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `Move the ${leadCount} lead(s) in this column to another stage before deleting it.` },
      { status: 409 }
    );
  }

  await prisma.pipelineStage.delete({ where: { id: params.id } });
  return ok();
}
