import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireSession } from '@/lib/apiAuth';
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

  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const folder = await prisma.resourceFolder.upsert({
    where: { name: parsed.data.name },
    create: { name: parsed.data.name, allowedUserIds: parsed.data.allowedUserIds },
    update: { allowedUserIds: parsed.data.allowedUserIds },
  });
  return NextResponse.json(folder);
}
