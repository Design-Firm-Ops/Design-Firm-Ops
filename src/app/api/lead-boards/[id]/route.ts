import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { leadBoardSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = leadBoardSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const board = await prisma.leadBoard.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(board);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const boardCount = await prisma.leadBoard.count();
  if (boardCount <= 1) {
    return NextResponse.json({ error: 'You must keep at least one board.' }, { status: 409 });
  }

  const leadCount = await prisma.lead.count({ where: { pipelineStage: { boardId: params.id } } });
  if (leadCount > 0) {
    return NextResponse.json(
      { error: `This board has ${leadCount} lead(s). Move or delete them before removing the board.` },
      { status: 409 }
    );
  }

  await prisma.leadBoard.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
