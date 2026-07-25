import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { notFound, parseBody } from '@/lib/apiRoute';
import { userPermissionOverrideSchema } from '@/lib/validation';

/**
 * Sets this one user's permission overrides — a field left out (or set
 * to null) means "inherit the Designer role default" for that
 * permission. See lib/permissions.ts for how these are resolved.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, userPermissionOverrideSchema);
  if (response) return response;

  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) return notFound();

  const override = await db.userPermissionOverride.upsert({
    where: { userId: params.id },
    create: { userId: params.id, firmId, ...data },
    update: data,
  });

  return NextResponse.json(override);
}
