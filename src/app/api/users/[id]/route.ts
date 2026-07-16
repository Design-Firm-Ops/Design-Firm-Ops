import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/apiAuth';
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

  const body = await req.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const demotingOrDeactivating =
    (parsed.data.role && parsed.data.role !== 'ADMIN') || parsed.data.active === false;

  if (demotingOrDeactivating) {
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (target?.role === 'ADMIN' && target.active) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: 'ADMIN', active: true, id: { not: params.id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json({ error: 'At least one active administrator is required' }, { status: 409 });
      }
    }
  }

  const { password, ...rest } = parsed.data;
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
