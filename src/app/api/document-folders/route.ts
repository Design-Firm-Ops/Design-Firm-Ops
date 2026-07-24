import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { documentFolderSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, documentFolderSchema);
  if (response) return response;

  const folder = await prisma.projectDocumentFolder.create({
    data: { ...data, order: await nextOrder(prisma.projectDocumentFolder, { projectId: data.projectId }) },
  });
  return NextResponse.json(folder, { status: 201 });
}
