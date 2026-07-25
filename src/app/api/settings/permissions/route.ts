import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { permissionsSchema } from '@/lib/validation';

export async function PUT(req: NextRequest) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, permissionsSchema);
  if (response) return response;

  const settings = await db.settings.upsert({
    where: { firmId },
    create: { companyName: 'Madison Ditton Interiors', firmId, ...data },
    update: data,
  });

  return NextResponse.json(settings);
}
