import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { authOptions } from '@/server/auth';
import { firmDenialFor } from '@/server/firmGate';
import { signInErrorMessage } from '@/lib/firmAccess';
import { isSuperAdmin } from '@/lib/tenant';

// Route auth. Everything after it — bodies, validation, error shapes — is in
// `apiRoute.ts`.

type Guard = { session: Session; unauthorized: null } | { session: null; unauthorized: NextResponse };

const deny = (message: string, status: number): Guard => ({
  session: null,
  unauthorized: NextResponse.json({ error: message }, { status }),
});

/**
 * Returns the session, or an unauthorized NextResponse to short-circuit the route.
 *
 * Also enforces the firm's lifecycle status (DES-27): a suspended or canceled
 * firm is refused here, not only at sign-in, so suspending a firm takes effect
 * on its users' next request rather than whenever their token happens to
 * expire.
 */
export async function requireSession(): Promise<Guard> {
  const session = await getServerSession(authOptions);
  if (!session) return deny('Unauthorized', 401);

  const denial = await firmDenialFor(session);
  if (denial) return deny(signInErrorMessage(denial), 403);

  return { session, unauthorized: null };
}

/** Like requireSession, but also rejects non-admins (user management, permission settings, etc). */
export async function requireAdmin(): Promise<Guard> {
  const guard = await requireSession();
  if (guard.unauthorized) return guard;

  if (guard.session.user.role !== 'ADMIN') {
    return deny('Administrator access required', 403);
  }
  return guard;
}

/**
 * The platform operator, for `/api/admin` routes.
 *
 * Deliberately does *not* go through `requireSession`: an operator belongs to
 * no firm, so there is no firm status to gate them on and that check would
 * only ever be a wasted query. It also must not be gated on one — the operator
 * is who lifts a suspension.
 */
export async function requireOperator(): Promise<Guard> {
  const session = await getServerSession(authOptions);
  if (!session) return deny('Unauthorized', 401);

  if (!isSuperAdmin(session)) {
    return deny('Platform operator access required', 403);
  }
  return { session, unauthorized: null };
}
