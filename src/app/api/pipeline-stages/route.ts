import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { pipelineStageSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const boardId = req.nextUrl.searchParams.get('boardId');
  const stages = await prisma.pipelineStage.findMany({
    where: boardId ? { boardId } : undefined,
    orderBy: { order: 'asc' },
  });
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

  const maxOrder = await prisma.pipelineStage.aggregate({
    where: { boardId: parsed.data.boardId },
    _max: { order: true },
  });
  const stage = await prisma.pipelineStage.create({
    data: { name: parsed.data.name, boardId: parsed.data.boardId, order: (maxOrder._max.order ?? 0) + 1 },
  });
  return NextResponse.json(stage, { status: 201 });
}
