import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UNSCOPED_MODELS } from '@/server/tenantDb';
import { UNSCOPED_MODEL_NAMES } from '@/lib/isolation';

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
  it('every API route uses the tenant-scoped client', () => {
    // NextAuth's handler is the one exception: it authenticates, and runs
    // before any tenant exists to scope to.
    const AUTH_HANDLER = join('src', 'app', 'api', 'auth', '[...nextauth]', 'route.ts');

    const unscoped = ROUTES.filter((f) => f !== AUTH_HANDLER).filter((f) => {
      const src = readFileSync(f, 'utf8');
      return !/tenantContext|getTenantDb/.test(src);
    });

    expect(unscoped, 'these routes do not go through the tenant client').toEqual([]);
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
  const SERVER = join('src', 'server');

  it('only the /admin console and src/server import it', () => {
    const importers = SRC.filter((f) => PLATFORM_CLIENT.test(readFileSync(f, 'utf8'))).filter(
      (f) => !f.startsWith(ADMIN) && !f.startsWith(SERVER)
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
      if (UNSCOPED_MODELS.has(name)) continue;
      if (!/^\s+firmId\s/m.test(body)) unscoped.push(name);
    }

    expect(
      unscoped,
      'These models carry no firmId, so the tenant client cannot scope them. ' +
        'Add firmId with a backfill migration, or add them to UNSCOPED_MODELS if ' +
        'they genuinely are not tenant-owned.'
    ).toEqual([]);
  });

  // The pure module and the server module each hold an exemption list; they
  // must agree, or the rules and the enforcement drift apart.
  it('the pure and server exemption lists agree', () => {
    expect([...UNSCOPED_MODELS].sort()).toEqual([...UNSCOPED_MODEL_NAMES].sort());
  });

  it('exempts only the tenant root', () => {
    expect([...UNSCOPED_MODELS]).toEqual(['Firm']);
  });
});
