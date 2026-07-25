import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { nextOrder } from '@/server/order';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { documentFolderSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, documentFolderSchema);
  if (response) return response;

  const folder = await db.projectDocumentFolder.create({
    data: { ...data, firmId, order: await nextOrder(db.projectDocumentFolder, { projectId: data.projectId }) },
  });
  return NextResponse.json(folder, { status: 201 });
}
