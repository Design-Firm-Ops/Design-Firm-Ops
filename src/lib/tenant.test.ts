import { describe, it, expect } from 'vitest';
import type { Session } from 'next-auth';
import { getTenantContext, requireFirmId, isSuperAdmin } from '@/lib/tenant';

function session(user: Partial<Session['user']>): Session {
  return {
    user: { id: 'u1', name: 'X', email: 'x@y.com', role: 'DESIGNER', firmId: 'firm-1', ...user },
    expires: '2999-01-01T00:00:00.000Z',
  } as Session;
}

const firmUser = session({ role: 'ADMIN', firmId: 'firm-1' });
const superAdmin = session({ role: 'SUPER_ADMIN', firmId: null });

describe('getTenantContext', () => {
  it('reports the tenant and role for a firm user', () => {
    expect(getTenantContext(firmUser)).toEqual({
      firmId: 'firm-1',
      role: 'ADMIN',
      isSuperAdmin: false,
      isAuthenticated: true,
    });
  });

  it('reports a super-admin as having no tenant', () => {
    expect(getTenantContext(superAdmin)).toEqual({
      firmId: null,
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      isAuthenticated: true,
    });
  });

  // A signed-out request must land on "no tenant, no role", never on a
  // default that some caller might read as permission.
  it('has no tenant and no role when signed out', () => {
    expect(getTenantContext(null)).toEqual({
      firmId: null,
      role: null,
      isSuperAdmin: false,
      isAuthenticated: false,
    });
  });

  it('treats a session with no user as signed out', () => {
    expect(getTenantContext({ expires: 'x' } as Session).isAuthenticated).toBe(false);
  });

  // Defence in depth: an unrecognized role must not be mistaken for the
  // platform operator.
  it('does not treat an unknown role as super-admin', () => {
    const ctx = getTenantContext(session({ role: 'ROOT' as never, firmId: null }));
    expect(ctx.isSuperAdmin).toBe(false);
  });

  it('reports a firm user missing a firmId as having none', () => {
    // Shouldn't happen — every firm user has a firmId — but the helper must
    // not invent one.
    expect(getTenantContext(session({ role: 'ADMIN', firmId: null })).firmId).toBeNull();
  });
});

describe('isSuperAdmin', () => {
  it('is true only for the platform operator', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(firmUser)).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe('requireFirmId', () => {
  it('returns the tenant for a firm user', () => {
    expect(requireFirmId(firmUser)).toBe('firm-1');
  });

  // The point of this helper: a query that needs a tenant must fail loudly
  // rather than run unscoped across every firm.
  it('throws for a super-admin, who has no tenant', () => {
    expect(() => requireFirmId(superAdmin)).toThrow(/no firm/i);
  });

  it('throws when signed out', () => {
    expect(() => requireFirmId(null)).toThrow(/no firm/i);
  });
});
