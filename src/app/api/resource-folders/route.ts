import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireSession } from '@/lib/apiAuth';
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

  const folder = await prisma.resourceFolder.upsert({
    where: { name: data.name },
    create: { name: data.name, allowedUserIds: data.allowedUserIds },
    update: { allowedUserIds: data.allowedUserIds },
  });
  return NextResponse.json(folder);
}
