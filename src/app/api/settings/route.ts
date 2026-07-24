import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const settings = await prisma.settings.findUnique({ where: { firmId: await currentFirmId() } });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, settingsSchema);
  if (response) return response;

  const firmId = await currentFirmId();
  const settings = await prisma.settings.upsert({
    where: { firmId },
    create: { ...data, firmId },
    update: data,
  });
  return NextResponse.json(settings);
}
