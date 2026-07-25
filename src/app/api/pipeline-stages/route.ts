import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { pipelineStageSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const boardId = req.nextUrl.searchParams.get('boardId');
  const stages = await db.pipelineStage.findMany({
    where: boardId ? { boardId } : undefined,
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, pipelineStageSchema);
  if (response) return response;

  const stage = await db.pipelineStage.create({
    data: { name: data.name, boardId: data.boardId, firmId, order: await nextOrder(db.pipelineStage, { boardId: data.boardId }) },
  });
  return NextResponse.json(stage, { status: 201 });
}
