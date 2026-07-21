import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
import { userPermissionOverrideSchema } from '@/lib/validation';

/**
 * Sets this one user's permission overrides — a field left out (or set
 * to null) means "inherit the Designer role default" for that
 * permission. See lib/permissions.ts for how these are resolved.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = userPermissionOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const override = await prisma.userPermissionOverride.upsert({
    where: { userId: params.id },
    create: { userId: params.id, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(override);
}
