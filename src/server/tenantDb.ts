import type { Session } from 'next-auth';
import { prisma } from '@/server/prisma';
import { requireFirmId } from '@/lib/tenant';

// Tenant isolation, enforced centrally.
//
// Every tenant-owned model carries a `firmId` (DES-23 + DES-25), so this
// extension applies one rule to all of them rather than a per-model map of
// relation paths — the map being the thing that would then have to never be
// wrong. Reads and writes get the firm merged into their `where`; creates get
// it stamped onto their payload; anything without a resolvable firm throws.
//
// The firm is captured in a closure rather than read from ambient request
// state, so one request's tenant cannot leak into another's.
//
// No operation needs rewriting: Prisma 5 accepts a non-unique field alongside a
// unique one ("extended where unique"), so `findUnique({ where: { id, firmId }})`
// is legal and returns null for another firm's row, while `update`/`delete`
// raise P2025 and leave it untouched. Return types are unchanged, so call sites
// behave exactly as before — for their own firm.

/**
 * The only model that is never scoped: `Firm` is the tenant root, so filtering
 * it by firmId would be circular, and listing firms is a platform-operator
 * concern rather than a tenant one.
 *
 * Everything else in the schema is tenant-owned and carries a firmId. A new
 * model added without one would silently go unscoped, so `tenantDb.test.ts`
 * asserts that every model in the Prisma client is either scoped or listed
 * here deliberately.
 */
export const UNSCOPED_MODELS = new Set(['Firm']);

/**
 * Models the tenant client refuses outright.
 *
 * A second exemption bucket, because "exempt" turned out to mean two different
 * things (DES-27). `UNSCOPED_MODELS` means *don't filter this* — `Firm` is the
 * tenant root, and the platform path reads it legitimately. `AuditLog` is not
 * that: it records what an operator did *to* a firm, so its `firmId` is a
 * target rather than an owner, and a firm must never read its own audit trail.
 *
 * Putting it in `UNSCOPED_MODELS` would have been the worst of both — unfiltered
 * *and* reachable, so firm-facing code touching it would see every firm's
 * records. Throwing instead keeps the fail-closed property: the tenant client
 * cannot reach this table even by accident.
 */
export const PLATFORM_ONLY_MODELS = new Set(['AuditLog']);

/** Operations that select existing rows: the firm belongs in `where`. */
const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that write new rows: the firm belongs in `data`. */
const CREATE_OPERATIONS = new Set(['create', 'createMany']);

export function withFirm(where: unknown, firmId: string): Record<string, unknown> {
  return { ...((where as Record<string, unknown> | undefined) ?? {}), firmId };
}

/** Stamps the firm onto a create payload, which may be one row or many. */
export function stampFirm(data: unknown, firmId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => ({ ...row, firmId }));
  return { ...((data as Record<string, unknown> | undefined) ?? {}), firmId };
}

export function tenantScope(firmId: string) {
  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && PLATFORM_ONLY_MODELS.has(model)) {
            throw new Error(
              `${model} is platform-only and cannot be read through a tenant client. ` +
                'Use getPlatformDb(session) from the /admin console.'
            );
          }

          if (!model || UNSCOPED_MODELS.has(model)) return query(args);

          const next = { ...(args as Record<string, unknown>) };

          if (WHERE_OPERATIONS.has(operation)) {
            next.where = withFirm(next.where, firmId);
          } else if (CREATE_OPERATIONS.has(operation)) {
            next.data = stampFirm(next.data, firmId);
          } else if (operation === 'upsert') {
            // Both halves: find by firm, and stamp the row it may insert.
            next.where = withFirm(next.where, firmId);
            next.create = stampFirm((next as { create?: unknown }).create, firmId);
          }

          return query(next);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantScope>;

// One extended client per firm. `$extends` is not free, and under a
// single-tenant deployment this holds a single entry.
const clients = new Map<string, TenantDb>();

/**
 * A database client scoped to this session's firm.
 *
 * Throws when the session has no firm — an unauthenticated caller, or a
 * SUPER_ADMIN, who is a platform operator rather than a firm member. That is
 * the fail-closed property: the alternative is a query that quietly spans every
 * tenant. Reaching firm data as a super-admin is impersonation (DES-#8) and has
 * to be deliberate.
 */
export function getTenantDb(session: Session | null | undefined): TenantDb {
  const firmId = requireFirmId(session);

  let client = clients.get(firmId);
  if (!client) {
    client = tenantScope(firmId);
    clients.set(firmId, client);
  }
  return client;
}

/**
 * The tenant-scoped client *and* the firm it's scoped to.
 *
 * The firmId is handed back because the extension cannot reach **nested**
 * writes — `client.create({ data: { contacts: { create: [...] } } })` is one
 * query, so `$allOperations` never sees the inner rows. Those need the firm
 * passed explicitly, and TypeScript requires it, which is how you find them.
 *
 * For top-level writes the extension still overrides whatever is passed, so a
 * wrong firmId cannot be written even by mistake.
 */
export function tenantContext(session: Session | null | undefined): { db: TenantDb; firmId: string } {
  return { db: getTenantDb(session), firmId: requireFirmId(session) };
}

/** Test seam: drop the memoized clients. */
export function resetTenantDbCache(): void {
  clients.clear();
}
