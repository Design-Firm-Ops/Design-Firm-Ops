import type { Session } from 'next-auth';

// Reading the tenant off a session.
//
// Pure by design — session in, context out, no database — so it sits on the
// pure side of the src/lib vs src/server boundary and can be reasoned about
// without mocks.
//
// Everything that needs to know "which firm is this request for" should come
// through here rather than reaching into `session.user.firmId` directly, so
// there's one place to change when the answer gets more complicated (notably
// impersonation, DES-#8).

export type Role = 'ADMIN' | 'DESIGNER' | 'SUPER_ADMIN';

export interface TenantContext {
  /** The firm this request belongs to; null for a super-admin or a signed-out request. */
  firmId: string | null;
  /** Null when signed out — deliberately not defaulted to a real role. */
  role: Role | null;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
}

/** True only for the platform operator. An unrecognized role is not one. */
export function isSuperAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'SUPER_ADMIN';
}

export function getTenantContext(session: Session | null | undefined): TenantContext {
  const user = session?.user;
  if (!user) {
    return { firmId: null, role: null, isSuperAdmin: false, isAuthenticated: false };
  }

  return {
    firmId: user.firmId ?? null,
    role: user.role ?? null,
    isSuperAdmin: isSuperAdmin(session),
    isAuthenticated: true,
  };
}

/**
 * The firm this request belongs to, or a thrown error.
 *
 * Use this wherever a query *must* be tenant-scoped. Failing loudly is the
 * point: the alternative is a query that quietly runs across every firm, which
 * is the exact failure mode multi-tenancy exists to prevent. A super-admin has
 * no tenant, so they hit this too — reaching firm data on their behalf is
 * impersonation (DES-#8), and it should have to be explicit.
 */
export function requireFirmId(session: Session | null | undefined): string {
  const { firmId, isSuperAdmin: superAdmin } = getTenantContext(session);
  if (firmId) return firmId;

  throw new Error(
    superAdmin
      ? 'This session has no firm: a SUPER_ADMIN is a platform operator and cannot read firm data directly.'
      : 'This session has no firm.'
  );
}

/**
 * The platform operator's user id, or a thrown error.
 *
 * The exact complement of `requireFirmId`: that one refuses a super-admin,
 * this one refuses everybody else. Between them no session can open both
 * doors, and none opens either by accident — which is what makes "cross-firm
 * reads go through an explicit path" a checkable claim rather than a habit.
 *
 * Returns the id because privileged actions need an actor to attribute them
 * to (DES-#8's audit log), and the caller shouldn't have to reach back into
 * the session for it.
 */
export function requireSuperAdmin(session: Session | null | undefined): string {
  if (!isSuperAdmin(session)) {
    throw new Error('This action requires a platform operator (SUPER_ADMIN).');
  }

  const id = session?.user?.id;
  if (!id) {
    // The role without an identity is a malformed session. Cross-firm access
    // is the wrong place to be lenient about that.
    throw new Error('A platform operator session carries no user id.');
  }

  return id;
}
