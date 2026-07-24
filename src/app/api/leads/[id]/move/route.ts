import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { leadMoveSchema } from '@/lib/validation';

/** Dedicated, lightweight endpoint for the kanban drag-and-drop move. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, leadMoveSchema);
  if (response) return response;

  const lead = await prisma.lead.update({ where: { id: params.id }, data: data });
  return NextResponse.json(lead);
}
