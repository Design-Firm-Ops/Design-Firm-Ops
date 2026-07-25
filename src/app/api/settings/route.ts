import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const settings = await db.settings.findUnique({ where: { firmId: firmId } });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, settingsSchema);
  if (response) return response;

  const settings = await db.settings.upsert({
    where: { firmId },
    create: { ...data, firmId },
    update: data,
  });
  return NextResponse.json(settings);
}
