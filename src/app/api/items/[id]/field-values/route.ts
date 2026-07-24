import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { isAdmin } from '@/lib/permissions';
import { fieldValueSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, fieldValueSchema);
  if (response) return response;

  const fieldDef = await prisma.itemFieldDef.findUnique({ where: { id: data.fieldDefId } });
  if (!fieldDef) return notFound();
  if (!isAdmin(session) && !fieldDef.visibleToDesigner) {
    return forbidden('You do not have permission to edit this field');
  }

  const value = await prisma.itemFieldValue.upsert({
    where: { itemId_fieldDefId: { itemId: params.id, fieldDefId: data.fieldDefId } },
    create: { itemId: params.id, fieldDefId: data.fieldDefId, value: data.value ?? null },
    update: { value: data.value ?? null },
  });
  return NextResponse.json(value);
}
