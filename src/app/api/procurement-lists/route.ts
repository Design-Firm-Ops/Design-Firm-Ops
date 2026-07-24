import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextOrder } from '@/lib/order';
import { requireSession } from '@/lib/apiAuth';
import { badRequest, parseBody } from '@/lib/apiRoute';
import { procurementListSchema } from '@/lib/validation';

export async function GET(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return badRequest('projectId is required');

  const lists = await prisma.procurementList.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, procurementListSchema);
  if (response) return response;

  const list = await prisma.procurementList.create({
    data: { ...data, order: await nextOrder(prisma.procurementList, { projectId: data.projectId }) },
  });
  return NextResponse.json(list, { status: 201 });
}
