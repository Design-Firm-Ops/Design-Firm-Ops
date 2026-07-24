import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nextOrder } from '@/lib/order';
import { requireAdmin, requireSession } from '@/lib/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { projectFieldDefSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const defs = await prisma.projectFieldDef.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(defs);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, projectFieldDefSchema);
  if (response) return response;

  const def = await prisma.projectFieldDef.create({
    data: { ...data, order: await nextOrder(prisma.projectFieldDef) },
  });
  return NextResponse.json(def, { status: 201 });
}
