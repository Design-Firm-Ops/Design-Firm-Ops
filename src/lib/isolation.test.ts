import { describe, it, expect } from 'vitest';
import {
  isTenantModel,
  checkQueryScope,
  canAccessTenantData,
  UNSCOPED_MODEL_NAMES,
} from '@/lib/isolation';

const FIRM = 'firm-a';

describe('isTenantModel', () => {
  it('treats everything except the tenant root as tenant-owned', () => {
    expect(isTenantModel('Project')).toBe(true);
    expect(isTenantModel('Document')).toBe(true);
    expect(isTenantModel('Firm')).toBe(false);
  });

  it('exempts only the tenant root', () => {
    expect([...UNSCOPED_MODEL_NAMES]).toEqual(['Firm']);
  });
});

describe('checkQueryScope — reads and targeted writes', () => {
  it('accepts a read filtered by firm', () => {
    expect(checkQueryScope('Project', 'findMany', { where: { firmId: FIRM } }, FIRM).scoped).toBe(true);
  });

  it('rejects a read with no firm filter', () => {
    const v = checkQueryScope('Project', 'findMany', { where: { status: 'ACTIVE' } }, FIRM);
    expect(v.scoped).toBe(false);
    expect(v.reason).toMatch(/no firmId in `where`/);
  });

  it('rejects a read with no where clause at all', () => {
    expect(checkQueryScope('Project', 'findMany', {}, FIRM).scoped).toBe(false);
    expect(checkQueryScope('Project', 'findMany', undefined, FIRM).scoped).toBe(false);
  });

  // The case that matters most: mentioning firmId isn't enough, it has to be
  // *this* firm.
  it("rejects a read scoped to somebody else's firm", () => {
    const v = checkQueryScope('Project', 'findMany', { where: { firmId: 'firm-b' } }, FIRM);
    expect(v.scoped).toBe(false);
    expect(v.reason).toMatch(/scoped to firm firm-b, expected firm-a/);
  });

  it('covers every filtered operation, not just findMany', () => {
    for (const op of ['findUnique', 'findFirst', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']) {
      expect(checkQueryScope('Item', op, { where: { id: 'x' } }, FIRM).scoped, op).toBe(false);
      expect(checkQueryScope('Item', op, { where: { id: 'x', firmId: FIRM } }, FIRM).scoped, op).toBe(true);
    }
  });
});

describe('checkQueryScope — creates', () => {
  it('requires the firm on the payload', () => {
    expect(checkQueryScope('Client', 'create', { data: { name: 'X' } }, FIRM).scoped).toBe(false);
    expect(checkQueryScope('Client', 'create', { data: { name: 'X', firmId: FIRM } }, FIRM).scoped).toBe(true);
  });

  it('checks every row of a createMany', () => {
    const ok = { data: [{ name: 'A', firmId: FIRM }, { name: 'B', firmId: FIRM }] };
    expect(checkQueryScope('Client', 'createMany', ok, FIRM).scoped).toBe(true);

    const mixed = { data: [{ name: 'A', firmId: FIRM }, { name: 'B' }] };
    expect(checkQueryScope('Client', 'createMany', mixed, FIRM).scoped).toBe(false);
  });

  it("rejects a create stamped with another firm", () => {
    expect(checkQueryScope('Client', 'create', { data: { firmId: 'firm-b' } }, FIRM).scoped).toBe(false);
  });
});

describe('checkQueryScope — upsert needs both halves', () => {
  it('accepts when where and create both carry the firm', () => {
    const args = { where: { id: 'x', firmId: FIRM }, create: { name: 'X', firmId: FIRM }, update: {} };
    expect(checkQueryScope('Settings', 'upsert', args, FIRM).scoped).toBe(true);
  });

  it('rejects when only the filter is scoped', () => {
    const args = { where: { id: 'x', firmId: FIRM }, create: { name: 'X' }, update: {} };
    const v = checkQueryScope('Settings', 'upsert', args, FIRM);
    expect(v.scoped).toBe(false);
    expect(v.reason).toMatch(/`create`/);
  });

  it('rejects when only the payload is scoped', () => {
    const args = { where: { id: 'x' }, create: { name: 'X', firmId: FIRM }, update: {} };
    expect(checkQueryScope('Settings', 'upsert', args, FIRM).scoped).toBe(false);
  });
});

describe('checkQueryScope — non-tenant models', () => {
  it('waves through the tenant root', () => {
    expect(checkQueryScope('Firm', 'findMany', {}, FIRM).scoped).toBe(true);
  });
});

describe('checkQueryScope — unknown operations fail closed', () => {
  // A future Prisma operation must not be waved through just because this
  // module has not been taught about it.
  it('refuses to certify an operation it does not recognize', () => {
    const v = checkQueryScope('Project', 'findRaw', { where: { firmId: FIRM } }, FIRM);
    expect(v.scoped).toBe(false);
    expect(v.reason).toMatch(/not a recognized operation/);
  });
});

describe('canAccessTenantData', () => {
  it('allows a firm member', () => {
    expect(canAccessTenantData({ firmId: FIRM, isSuperAdmin: false })).toBe(true);
  });

  it('refuses a session with no firm', () => {
    expect(canAccessTenantData({ firmId: null, isSuperAdmin: false })).toBe(false);
  });

  it('refuses a super-admin even if a firm somehow got attached', () => {
    expect(canAccessTenantData({ firmId: FIRM, isSuperAdmin: true })).toBe(false);
  });
});
