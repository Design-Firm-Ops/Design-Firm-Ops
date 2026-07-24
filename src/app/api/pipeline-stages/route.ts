import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
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

  const { data, response } = await parseBody(req, pipelineStageSchema);
  if (response) return response;

  const stage = await prisma.pipelineStage.create({
    data: { name: data.name, boardId: data.boardId, order: await nextOrder(prisma.pipelineStage, { boardId: data.boardId }) },
  });
  return NextResponse.json(stage, { status: 201 });
}
