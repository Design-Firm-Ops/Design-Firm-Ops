import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { conflict, parseBody } from '@/lib/apiRoute';
import { leadBoardSchema } from '@/lib/validation';

const MAX_BOARDS = 5;

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const boards = await prisma.leadBoard.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, leadBoardSchema);
  if (response) return response;

  const count = await prisma.leadBoard.count();
  if (count >= MAX_BOARDS) {
    return conflict(`You can have at most ${MAX_BOARDS} boards.`);
  }

  const firmId = await currentFirmId();
  const board = await prisma.leadBoard.create({
    data: { name: data.name, firmId, order: await nextOrder(prisma.leadBoard, { firmId }) },
  });

  // A brand-new board needs at least one column to be usable.
  await prisma.pipelineStage.create({ data: { name: 'New Lead', boardId: board.id, order: 0 } });

  return NextResponse.json(board, { status: 201 });
}
