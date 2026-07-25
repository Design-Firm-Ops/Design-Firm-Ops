import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { conflict, parseBody } from '@/lib/apiRoute';
import { leadBoardSchema } from '@/lib/validation';

const MAX_BOARDS = 5;

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const boards = await db.leadBoard.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, leadBoardSchema);
  if (response) return response;

  const count = await db.leadBoard.count();
  if (count >= MAX_BOARDS) {
    return conflict(`You can have at most ${MAX_BOARDS} boards.`);
  }

  const board = await db.leadBoard.create({
    data: { name: data.name, firmId, order: await nextOrder(db.leadBoard, { firmId }) },
  });

  // A brand-new board needs at least one column to be usable.
  await db.pipelineStage.create({ data: { name: 'New Lead', boardId: board.id, order: 0, firmId } });

  return NextResponse.json(board, { status: 201 });
}
