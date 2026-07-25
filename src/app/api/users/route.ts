import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTenantDb } from '@/server/tenantDb';
import { requireAdmin } from '@/server/apiAuth';
import { conflict, parseBody } from '@/lib/apiRoute';
import { userCreateSchema } from '@/lib/validation';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export async function GET() {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const users = await db.user.findMany({ select: USER_SELECT, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, userCreateSchema);
  if (response) return response;

  const email = data.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return conflict('A user with that email already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await db.user.create({
    data: { name: data.name, email, passwordHash, role: data.role },
    select: USER_SELECT,
  });

  return NextResponse.json(user, { status: 201 });
}
