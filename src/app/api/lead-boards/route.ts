import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
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

  const body = await req.json();
  const parsed = leadBoardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const count = await prisma.leadBoard.count();
  if (count >= MAX_BOARDS) {
    return NextResponse.json({ error: `You can have at most ${MAX_BOARDS} boards.` }, { status: 409 });
  }

  const maxOrder = await prisma.leadBoard.aggregate({ _max: { order: true } });
  const board = await prisma.leadBoard.create({
    data: { name: parsed.data.name, order: (maxOrder._max.order ?? -1) + 1 },
  });

  // A brand-new board needs at least one column to be usable.
  await prisma.pipelineStage.create({ data: { name: 'New Lead', boardId: board.id, order: 0 } });

  return NextResponse.json(board, { status: 201 });
}
