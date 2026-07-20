import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { isAdmin } from '@/lib/permissions';
import { fieldValueSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = fieldValueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const fieldDef = await prisma.projectFieldDef.findUnique({ where: { id: parsed.data.fieldDefId } });
  if (!fieldDef) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isAdmin(session) && !fieldDef.visibleToDesigner) {
    return NextResponse.json({ error: 'You do not have permission to edit this field' }, { status: 403 });
  }

  const value = await prisma.projectFieldValue.upsert({
    where: { projectId_fieldDefId: { projectId: params.id, fieldDefId: parsed.data.fieldDefId } },
    create: { projectId: params.id, fieldDefId: parsed.data.fieldDefId, value: parsed.data.value ?? null },
    update: { value: parsed.data.value ?? null },
  });
  return NextResponse.json(value);
}
