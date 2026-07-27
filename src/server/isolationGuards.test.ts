import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UNSCOPED_MODELS, PLATFORM_ONLY_MODELS } from '@/server/tenantDb';
import { UNSCOPED_MODEL_NAMES, PLATFORM_ONLY_MODEL_NAMES } from '@/lib/isolation';

// Structural half of the isolation gate.
//
// The behavioural matrix proves the tenant client isolates every model. These
// guards prove the *other* half of the argument: that nothing bypasses it. If
// both hold, no route can reach another firm's rows — which is the claim the
// /admin console is being allowed to rely on.

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

const SRC = walk('src').filter((f) => !f.includes('.test.'));
const ROUTES = walk('src/app/api').filter((f) => f.endsWith('route.ts'));

describe('the tenant client is the only way into tenant data', () => {
  // The invariant, stated once: **no route reaches the database except through
  // a named door that carries its own guarantee.** There are three doors now,
  // for three genuinely different situations — a route belonging to none of
  // them still fails, which is what keeps this a check rather than a list of
  // excuses.
  it('every API route goes through a guarded door', () => {
    // NextAuth's handler is the one true exception: it authenticates, and runs
    // before any tenant exists to scope to.
    const AUTH_HANDLER = join('src', 'app', 'api', 'auth', '[...nextauth]', 'route.ts');
    const ADMIN_API = join('src', 'app', 'api', 'admin');
    const SIGNUP = join('src', 'app', 'api', 'signup', 'route.ts');

    const unscoped = ROUTES.filter((f) => f !== AUTH_HANDLER).filter((f) => {
      const src = readFileSync(f, 'utf8');

      // Sign-up has no tenant to scope to because it *creates* one (DES-28).
      // Its door is `provisionFirm`, which stamps everything to the firm it
      // just made, in one transaction.
      if (f === SIGNUP) return !/provisionFirm/.test(src);

      // /api/admin routes are cross-firm by nature (DES-27's suspend/cancel),
      // so they go through the platform client, which carries its own
      // SUPER_ADMIN check.
      if (f.startsWith(ADMIN_API)) return !/getPlatformDb/.test(src);

      return !/tenantContext|getTenantDb/.test(src);
    });

    expect(unscoped, 'these routes reach the database without a guarded door').toEqual([]);
  });

  // The sign-up door only means anything if sign-up walks through it and does
  // nothing else — a route that also queried directly would be scoped to a
  // tenant in name only.
  it('sign-up touches the database only through provisionFirm', () => {
    const signup = join('src', 'app', 'api', 'signup', 'route.ts');
    const src = readFileSync(signup, 'utf8');

    // It imports the raw client to hand to provisionFirm, which is the one
    // legitimate reason — but must not call anything on it itself.
    const directQueries = [...src.matchAll(/\bprisma\.(\w+)\b/g)].map((m) => m[0]);
    expect(directQueries, 'sign-up queries the database directly').toEqual([]);
  });

  // Added because probing found it missing: every other property of this route
  // was pinned, and deleting the rate limit entirely still passed the suite.
  // An unauthenticated endpoint that creates tenants must not lose its limiter
  // silently.
  it('sign-up is rate limited', () => {
    const src = readFileSync(join('src', 'app', 'api', 'signup', 'route.ts'), 'utf8');

    expect(src, 'sign-up no longer rate limits').toMatch(/createRateLimiter/);
    expect(src, 'the limiter is created but never consulted').toMatch(/\.check\(/);
    expect(src, 'a refused sign-up must answer 429').toMatch(/429/);
  });

  // The console's own routes must not quietly fall back to the tenant client:
  // an operator has no firm, so it would throw — and reaching for it signals
  // the route was written against the wrong model of who is calling.
  it('admin API routes use the operator guard, not the firm one', () => {
    const adminRoutes = ROUTES.filter((f) => f.startsWith(join('src', 'app', 'api', 'admin')));
    expect(adminRoutes.length, 'no admin routes found — has the path changed?').toBeGreaterThan(0);

    const wrongGuard = adminRoutes.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return !/requireOperator/.test(src) || /tenantContext|getTenantDb/.test(src);
    });

    expect(wrongGuard, 'these admin routes are guarded as if a firm were calling').toEqual([]);
  });

  it('no route imports the raw prisma client', () => {
    const raw = ROUTES.filter((f) => /from '@\/server\/prisma'/.test(readFileSync(f, 'utf8')));
    expect(raw, 'these routes bypass tenant scoping').toEqual([]);
  });

  // Raw SQL goes straight past the extension, so it would silently defeat the
  // whole mechanism. There is none in application code; this keeps it that way.
  //
  // `src/test/` is exempt: the isolation harness issues CREATE/DROP DATABASE to
  // build its own throwaway database. That's DDL against a scratch database,
  // not tenant data access — and it is precisely what makes this suite able to
  // prove anything.
  it('no raw SQL in application code', () => {
    const rawSql = SRC.filter((f) => !f.startsWith(join('src', 'test'))).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /\$queryRaw|\$executeRaw|\$queryRawUnsafe|\$executeRawUnsafe/.test(src);
    });
    expect(rawSql, 'raw SQL bypasses the tenant client').toEqual([]);
  });

  it('page components do not query the database directly', () => {
    // All of src/app, not just the firm-facing half: the /admin console reads
    // across firms and must still go through `getPlatformDb`, where the
    // SUPER_ADMIN check lives.
    const pages = walk('src/app').filter((f) => f.endsWith('page.tsx') || f.endsWith('layout.tsx'));
    const querying = pages.filter((f) => /from '@\/server\/prisma'/.test(readFileSync(f, 'utf8')));
    expect(querying).toEqual([]);
  });
});

// The /admin console is the one place that deliberately reads across firms
// (DES-26). That makes `platformDb` the single exception to everything above,
// so it gets guarded the same way the rule it excepts is guarded.
describe('the cross-firm client is reachable from one place only', () => {
  const PLATFORM_CLIENT = /from '@\/server\/platformDb'/;
  const ADMIN = join('src', 'app', 'admin');
  // The console's own API routes, listed precisely rather than as all of
  // src/app/api — widening this to the whole API directory would retire the
  // guard rather than adjust it.
  const ADMIN_API = join('src', 'app', 'api', 'admin');
  const SERVER = join('src', 'server');
  const ALLOWED = [ADMIN, ADMIN_API, SERVER];

  it('only the /admin console and src/server import it', () => {
    const importers = SRC.filter((f) => PLATFORM_CLIENT.test(readFileSync(f, 'utf8'))).filter(
      (f) => !ALLOWED.some((dir) => f.startsWith(dir))
    );

    expect(
      importers,
      'these files read across every firm. Firm-facing code must use tenantContext(session).'
    ).toEqual([]);
  });

  // Every route into the console has to pass the door, so the door cannot be
  // something a page merely *may* use.
  it('every /admin page reaching the database goes through it', () => {
    const pages = walk(ADMIN).filter((f) => f.endsWith('page.tsx'));
    const querying = pages.filter((f) => /@\/server\//.test(readFileSync(f, 'utf8')));

    const bypassing = querying.filter((f) => !PLATFORM_CLIENT.test(readFileSync(f, 'utf8')));
    expect(bypassing, 'these console pages read data without the platform client').toEqual([]);
  });

  // Two copies of the import policy exist because the console needs one narrow
  // exception to it. This pins that the exception is only that one — the
  // console must still be barred from raw prisma, which the DES-33 lesson says
  // to verify rather than assume.
  it('the /admin override still bans raw prisma', () => {
    const config = JSON.parse(readFileSync('.eslintrc.json', 'utf8'));
    const override = config.overrides.find((o: { files: string[] }) => o.files.includes('src/app/admin/**'));

    expect(override, 'no ESLint override for the /admin console').toBeDefined();

    const groups: string[] = override.rules['no-restricted-imports'][1].patterns.flatMap(
      (p: { group: string[] }) => p.group
    );
    expect(groups).toContain('@/server/prisma');
    expect(groups, 'the console may import the platform client — that is the exception').not.toContain(
      '@/server/platformDb'
    );
  });
});

describe('the scoped-model list stays honest', () => {
  it('every model in the schema carries firmId or is deliberately exempt', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const unscoped: string[] = [];

    for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, name, body] = match;
      if (UNSCOPED_MODELS.has(name) || PLATFORM_ONLY_MODELS.has(name)) continue;
      if (!/^\s+firmId\s/m.test(body)) unscoped.push(name);
    }

    expect(
      unscoped,
      'These models carry no firmId, so the tenant client cannot scope them. ' +
        'Add firmId with a backfill migration, or add them to UNSCOPED_MODELS if ' +
        'they genuinely are not tenant-owned.'
    ).toEqual([]);
  });

  // The pure module and the server module each hold the exemption lists; they
  // must agree, or the rules and the enforcement drift apart.
  it('the pure and server exemption lists agree', () => {
    expect([...UNSCOPED_MODELS].sort()).toEqual([...UNSCOPED_MODEL_NAMES].sort());
    expect([...PLATFORM_ONLY_MODELS].sort()).toEqual([...PLATFORM_ONLY_MODEL_NAMES].sort());
  });

  // "Exempt" means two different things, and conflating them is how a table
  // ends up both unfiltered and reachable (DES-27). Each bucket is pinned to
  // its members so adding a third has to be a deliberate edit here, with a
  // reason — the point of the original "exactly one exempt model" assertion,
  // kept rather than relaxed.
  it('each exemption is in exactly one bucket, for a stated reason', () => {
    // Not filtered, and legitimately readable through the platform path.
    expect([...UNSCOPED_MODELS]).toEqual(['Firm']);
    // Refused outright by the tenant client — a firm may not read these at all.
    expect([...PLATFORM_ONLY_MODELS]).toEqual(['AuditLog']);

    const overlap = [...UNSCOPED_MODELS].filter((m) => PLATFORM_ONLY_MODELS.has(m));
    expect(overlap, 'a model cannot be both unfiltered and forbidden').toEqual([]);
  });

  // The distinction only means anything if the tenant client actually refuses.
  it('the tenant client refuses a platform-only model', async () => {
    const { tenantScope } = await import('@/server/tenantDb');
    const db = tenantScope('firm-1') as unknown as { auditLog: { findMany: () => Promise<unknown> } };

    await expect(db.auditLog.findMany()).rejects.toThrow(/platform-only/i);
  });
});
