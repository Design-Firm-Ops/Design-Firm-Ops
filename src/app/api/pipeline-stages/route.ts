import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { pipelineStageSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const stages = await prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = pipelineStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const maxOrder = await prisma.pipelineStage.aggregate({ _max: { order: true } });
  const stage = await prisma.pipelineStage.create({
    data: { name: parsed.data.name, order: (maxOrder._max.order ?? 0) + 1 },
  });
  return NextResponse.json(stage, { status: 201 });
}
