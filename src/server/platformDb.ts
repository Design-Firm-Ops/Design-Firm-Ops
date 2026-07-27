import type { Session } from 'next-auth';
import { prisma } from '@/server/prisma';
import { requireSuperAdmin } from '@/lib/tenant';

// The one deliberate cross-firm path.
//
// Everything else in this app reaches the database through `tenantDb`, which
// scopes every query to a single firm. The /admin console genuinely has to see
// across firms, and the honest way to allow that is one named module that is
// hard to reach by accident — not an exemption sprinkled wherever it's needed.
// (plans/ADMIN_DASHBOARD.md §3.4; DES-26.)
//
// Deliberately the mirror image of `getTenantDb`: that one throws for a
// super-admin, this one throws for everyone else. Because the two guards are
// exact complements, "cross-firm reads only happen for the platform operator"
// is a property you can check rather than a convention you have to trust.
//
// Kept as the only door by three things, since a convention nobody enforces is
// not a boundary:
//   1. an ESLint rule — only `src/app/admin/**` and `src/server/**` may import it;
//   2. a structural guard in `isolationGuards.test.ts`, so it fails tests too;
//   3. a behavioural test in the isolation suite, against a real two-firm database.
//
// The client is intentionally *unextended*. That is the entire purpose of the
// module, and why the authorization check lives here at the door rather than
// being repeated in each query.

export type PlatformDb = typeof prisma;

/**
 * An unscoped database client, for the platform operator only.
 *
 * Throws for any other session — including a firm ADMIN, who is the most
 * privileged role inside a firm and still has no business reading another
 * firm's rows.
 *
 * Reads through this client span every tenant, so callers must be code that
 * means to do that: the /admin console. Anything firm-facing wants
 * `tenantContext(session)` instead.
 */
export function getPlatformDb(session: Session | null | undefined): PlatformDb {
  requireSuperAdmin(session);
  return prisma;
}
