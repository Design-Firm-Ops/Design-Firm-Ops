import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { isAdmin } from '@/lib/permissions';
import { fieldValueSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, fieldValueSchema);
  if (response) return response;

  const fieldDef = await db.projectFieldDef.findUnique({ where: { id: data.fieldDefId } });
  if (!fieldDef) return notFound();
  if (!isAdmin(session) && !fieldDef.visibleToDesigner) {
    return forbidden('You do not have permission to edit this field');
  }

  const value = await db.projectFieldValue.upsert({
    where: { projectId_fieldDefId: { projectId: params.id, fieldDefId: data.fieldDefId } },
    create: { projectId: params.id, fieldDefId: data.fieldDefId, value: data.value ?? null, firmId },
    update: { value: data.value ?? null },
  });
  return NextResponse.json(value);
}
