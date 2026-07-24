import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/prisma';
import { requireAdmin } from '@/server/apiAuth';
import { conflict, parseBody } from '@/lib/apiRoute';
import { userUpdateSchema } from '@/lib/validation';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, userUpdateSchema);
  if (response) return response;

  const demotingOrDeactivating =
    (data.role && data.role !== 'ADMIN') || data.active === false;

  if (demotingOrDeactivating) {
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (target?.role === 'ADMIN' && target.active) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: 'ADMIN', active: true, id: { not: params.id } },
      });
      if (otherActiveAdmins === 0) {
        return conflict('At least one active administrator is required');
      }
    }
  }

  const { password, ...rest } = data;
  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: USER_SELECT,
  });

  return NextResponse.json(user);
}
