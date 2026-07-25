import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Session } from 'next-auth';
import { getTenantDb, resetTenantDbCache, withFirm, stampFirm, UNSCOPED_MODELS } from '@/server/tenantDb';

vi.mock('@/server/prisma', () => ({
  prisma: { $extends: (ext: unknown) => ({ __extended: ext }) },
}));

beforeEach(() => {
  resetTenantDbCache();
});

const firmSession = { user: { id: 'u', role: 'ADMIN', firmId: 'firm-1' } } as Session;
const superAdmin = { user: { id: 'u', role: 'SUPER_ADMIN', firmId: null } } as Session;

describe('getTenantDb — fails closed', () => {
  it('refuses an unauthenticated session', () => {
    expect(() => getTenantDb(null)).toThrow(/no firm/i);
    expect(() => getTenantDb(undefined)).toThrow(/no firm/i);
  });

  // A super-admin is a platform operator, not a firm member. Reaching firm
  // data on their behalf is impersonation and has to be deliberate.
  it('refuses a super-admin session, explaining why', () => {
    expect(() => getTenantDb(superAdmin)).toThrow(/platform operator/i);
  });

  it('returns a client for a firm session', () => {
    expect(getTenantDb(firmSession)).toBeDefined();
  });

  it('memoizes one client per firm', () => {
    const a = getTenantDb(firmSession);
    expect(getTenantDb(firmSession)).toBe(a);

    const other = getTenantDb({ user: { id: 'v', role: 'ADMIN', firmId: 'firm-2' } } as Session);
    expect(other).not.toBe(a);
  });
});

describe('withFirm', () => {
  it('adds the firm to an empty or missing filter', () => {
    expect(withFirm(undefined, 'f1')).toEqual({ firmId: 'f1' });
    expect(withFirm({}, 'f1')).toEqual({ firmId: 'f1' });
  });

  it('preserves the caller’s filter', () => {
    expect(withFirm({ id: 'x', status: 'ACTIVE' }, 'f1')).toEqual({ id: 'x', status: 'ACTIVE', firmId: 'f1' });
  });

  // The context is authoritative: a caller cannot widen their own scope by
  // passing someone else's firm.
  it('overrides a caller-supplied firmId', () => {
    expect(withFirm({ id: 'x', firmId: 'attacker' }, 'f1')).toEqual({ id: 'x', firmId: 'f1' });
  });
});

describe('stampFirm', () => {
  it('stamps a single row', () => {
    expect(stampFirm({ name: 'X' }, 'f1')).toEqual({ name: 'X', firmId: 'f1' });
  });

  it('stamps every row of a createMany payload', () => {
    expect(stampFirm([{ name: 'A' }, { name: 'B' }], 'f1')).toEqual([
      { name: 'A', firmId: 'f1' },
      { name: 'B', firmId: 'f1' },
    ]);
  });

  it('overrides a caller-supplied firmId', () => {
    expect(stampFirm({ name: 'X', firmId: 'attacker' }, 'f1')).toEqual({ name: 'X', firmId: 'f1' });
  });

  it('handles a missing payload', () => {
    expect(stampFirm(undefined, 'f1')).toEqual({ firmId: 'f1' });
  });
});

// The regression guard that matters most: a model added later without a firmId
// would be silently unscoped by the extension. This reads the schema directly
// so it fails the moment that happens.
describe('every model is scoped', () => {
  it('has a firmId on every model except those deliberately exempt', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const unscoped: string[] = [];

    for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, name, body] = match;
      if (UNSCOPED_MODELS.has(name)) continue;
      if (!/^\s+firmId\s/m.test(body)) unscoped.push(name);
    }

    expect(
      unscoped,
      `These models carry no firmId, so the tenant client cannot scope them. ` +
        `Add firmId (with a backfill migration), or add them to UNSCOPED_MODELS ` +
        `if they genuinely are not tenant-owned.`
    ).toEqual([]);
  });

  it('exempts only the tenant root itself', () => {
    expect([...UNSCOPED_MODELS]).toEqual(['Firm']);
  });
});
