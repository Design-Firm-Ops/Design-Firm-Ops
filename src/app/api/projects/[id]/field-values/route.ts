import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { isAdmin } from '@/lib/permissions';
import { fieldValueSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, fieldValueSchema);
  if (response) return response;

  const fieldDef = await prisma.projectFieldDef.findUnique({ where: { id: data.fieldDefId } });
  if (!fieldDef) return notFound();
  if (!isAdmin(session) && !fieldDef.visibleToDesigner) {
    return forbidden('You do not have permission to edit this field');
  }

  const value = await prisma.projectFieldValue.upsert({
    where: { projectId_fieldDefId: { projectId: params.id, fieldDefId: data.fieldDefId } },
    create: { projectId: params.id, fieldDefId: data.fieldDefId, value: data.value ?? null },
    update: { value: data.value ?? null },
  });
  return NextResponse.json(value);
}
