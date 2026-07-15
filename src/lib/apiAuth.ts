import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

/** Returns the session, or an unauthorized NextResponse to short-circuit the route. */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, unauthorized: null };
}
