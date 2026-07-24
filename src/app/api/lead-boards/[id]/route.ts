import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { conflict, ok, parseBody } from '@/lib/apiRoute';
import { leadBoardSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, leadBoardSchema.partial());
  if (response) return response;

  const board = await prisma.leadBoard.update({ where: { id: params.id }, data: data });
  return NextResponse.json(board);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const boardCount = await prisma.leadBoard.count();
  if (boardCount <= 1) {
    return conflict('You must keep at least one board.');
  }

  const leadCount = await prisma.lead.count({ where: { pipelineStage: { boardId: params.id } } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `This board has ${leadCount} lead(s). Move or delete them before removing the board.` },
      { status: 409 }
    );
  }

  await prisma.leadBoard.delete({ where: { id: params.id } });
  return ok();
}
