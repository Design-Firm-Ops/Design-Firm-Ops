import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTenantDb } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { conflict, parseBody } from '@/lib/apiRoute';
import { userUpdateSchema } from '@/lib/validation';
import { isSelfDeactivation, SELF_DEACTIVATION_MESSAGE } from '@/lib/userAdmin';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, userUpdateSchema);
  if (response) return response;

  // Checked before the last-admin rule below, which protects the *firm* from
  // losing its administrators. This one protects the person: deactivation
  // blocks sign-in, so doing it to yourself is an immediate lockout you cannot
  // undo yourself — and it is refused even when a colleague would remain admin.
  if (isSelfDeactivation(session.user.id, params.id, data)) {
    return conflict(SELF_DEACTIVATION_MESSAGE);
  }

  const demotingOrDeactivating =
    (data.role && data.role !== 'ADMIN') || data.active === false;

  if (demotingOrDeactivating) {
    const target = await db.user.findUnique({ where: { id: params.id } });
    if (target?.role === 'ADMIN' && target.active) {
      const otherActiveAdmins = await db.user.count({
        where: { role: 'ADMIN', active: true, id: { not: params.id } },
      });
      if (otherActiveAdmins === 0) {
        return conflict('At least one active administrator is required');
      }
    }
  }

  const { password, ...rest } = data;
  const user = await db.user.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: USER_SELECT,
  });

  return NextResponse.json(user);
}
