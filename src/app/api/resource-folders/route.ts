import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { requireAdmin, requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { resourceFolderPermissionSchema } from '@/lib/validation';
import { z } from 'zod';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const folders = await prisma.resourceFolder.findMany();
  return NextResponse.json(folders);
}

const upsertSchema = resourceFolderPermissionSchema.extend({
  name: z.string().min(1),
});

/** Admin-only: set (or clear) the allow-list for a Storage Center folder, identified by name. */
export async function PUT(req: NextRequest) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, upsertSchema);
  if (response) return response;

  const firmId = await currentFirmId();
  const folder = await prisma.resourceFolder.upsert({
    where: { firmId_name: { firmId, name: data.name } },
    create: { name: data.name, firmId, allowedUserIds: data.allowedUserIds },
    update: { allowedUserIds: data.allowedUserIds },
  });
  return NextResponse.json(folder);
}
