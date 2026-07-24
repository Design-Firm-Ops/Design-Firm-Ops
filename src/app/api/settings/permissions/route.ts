import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { permissionsSchema } from '@/lib/validation';

export async function PUT(req: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, permissionsSchema);
  if (response) return response;

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, companyName: 'Madison Ditton Interiors', ...data },
    update: data,
  });

  return NextResponse.json(settings);
}
