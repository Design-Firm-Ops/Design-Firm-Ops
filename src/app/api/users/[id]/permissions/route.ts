import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
import { notFound, parseBody } from '@/lib/apiRoute';
import { userPermissionOverrideSchema } from '@/lib/validation';

/**
 * Sets this one user's permission overrides — a field left out (or set
 * to null) means "inherit the Designer role default" for that
 * permission. See lib/permissions.ts for how these are resolved.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, userPermissionOverrideSchema);
  if (response) return response;

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return notFound();

  const override = await prisma.userPermissionOverride.upsert({
    where: { userId: params.id },
    create: { userId: params.id, ...data },
    update: data,
  });

  return NextResponse.json(override);
}
