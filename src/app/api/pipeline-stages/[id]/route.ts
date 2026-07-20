import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { pipelineStageUpdateSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = pipelineStageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const stage = await prisma.pipelineStage.update({ where: { id: params.id }, data: parsed.data });
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
  return NextResponse.json({ ok: true });
}
