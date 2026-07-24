import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/server/auth';

/** Returns the session, or an unauthorized NextResponse to short-circuit the route. */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, unauthorized: null };
}

/** Like requireSession, but also rejects non-admins (user management, permission settings, etc). */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'ADMIN') {
    return { session: null, unauthorized: NextResponse.json({ error: 'Administrator access required' }, { status: 403 }) };
  }
  return { session, unauthorized: null };
}
