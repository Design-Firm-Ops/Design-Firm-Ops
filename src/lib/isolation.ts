// The tenant-isolation invariants, as functions rather than assertions buried
// in a test file.
//
// Pure by design — a model name and a query object in, a verdict out — so the
// rules can be unit-tested without a database, reused by the integration
// matrix, and (later) called from a dev-mode runtime check.
//
// The behavioural proof that these rules are actually *enforced* lives in the
// integration suite (`*.isolation.test.ts`), which runs the real tenant client
// against a real Postgres. This module is the vocabulary; that is the evidence.

/**
 * The only model that is never tenant-scoped. `Firm` is the tenant root, so
 * filtering it by firmId would be circular, and listing firms is a
 * platform-operator concern.
 *
 * Kept in step with `UNSCOPED_MODELS` in `@/server/tenantDb` by a test — this
 * module is the pure side and must not import from `src/server`.
 */
export const UNSCOPED_MODEL_NAMES: readonly string[] = ['Firm'];

/** Operations whose `where` selects existing rows, so it must carry the firm. */
export const FILTERED_OPERATIONS: readonly string[] = [
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
];

/** Operations that write new rows, so the firm must be stamped onto the payload. */
export const CREATING_OPERATIONS: readonly string[] = ['create', 'createMany'];

export function isTenantModel(model: string): boolean {
  return !UNSCOPED_MODEL_NAMES.includes(model);
}

export interface ScopeVerdict {
  scoped: boolean;
  /** Why it isn't scoped — phrased for a failing test message. */
  reason?: string;
}

const SCOPED: ScopeVerdict = { scoped: true };

function firmIdOf(value: unknown): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>).firmId;
}

/**
 * Whether a query about to hit the database is properly tenant-scoped.
 *
 * The rule differs by operation: reads and targeted writes must filter by
 * `firmId`; creates must carry it in the payload. `upsert` has to do both,
 * since it may either find or insert.
 *
 * @param expectedFirmId when given, the scoping must name *this* firm — that's
 * what catches a query scoped to somebody else's tenant, as opposed to one
 * that merely mentions `firmId`.
 */
export function checkQueryScope(
  model: string,
  operation: string,
  args: unknown,
  expectedFirmId?: string
): ScopeVerdict {
  if (!isTenantModel(model)) return SCOPED;

  const a = (args ?? {}) as Record<string, unknown>;

  const requireFirmOn = (part: unknown, label: string): ScopeVerdict | null => {
    const firmId = firmIdOf(part);
    if (firmId === undefined) {
      return { scoped: false, reason: `${model}.${operation} has no firmId in \`${label}\`` };
    }
    if (expectedFirmId !== undefined && firmId !== expectedFirmId) {
      return {
        scoped: false,
        reason: `${model}.${operation} is scoped to firm ${String(firmId)}, expected ${expectedFirmId}`,
      };
    }
    return null;
  };

  if (operation === 'upsert') {
    return requireFirmOn(a.where, 'where') ?? requireFirmOn(a.create, 'create') ?? SCOPED;
  }

  if (CREATING_OPERATIONS.includes(operation)) {
    const rows = Array.isArray(a.data) ? a.data : [a.data];
    for (const row of rows) {
      const bad = requireFirmOn(row, 'data');
      if (bad) return bad;
    }
    return SCOPED;
  }

  if (FILTERED_OPERATIONS.includes(operation)) {
    return requireFirmOn(a.where, 'where') ?? SCOPED;
  }

  // An operation we don't classify (e.g. a future Prisma addition) is treated
  // as unscoped rather than waved through — failing closed applies to the rules
  // themselves, not just to queries.
  return { scoped: false, reason: `${model}.${operation} is not a recognized operation, so it cannot be verified as scoped` };
}

/**
 * Whether a session's tenant context may touch tenant data at all.
 *
 * A platform operator has no firm, so the answer is no — reaching firm data on
 * their behalf is impersonation and must be explicit.
 */
export function canAccessTenantData(context: { firmId: string | null; isSuperAdmin: boolean }): boolean {
  return context.firmId !== null && !context.isSuperAdmin;
}
