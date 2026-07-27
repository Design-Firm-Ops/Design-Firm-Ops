import { describe, it, expect } from 'vitest';
import type { Session } from 'next-auth';
import { getPlatformDb } from '@/server/platformDb';
import { getTenantDb } from '@/server/tenantDb';

// The cross-firm door.
//
// These assert the property the /admin console rests on: the platform client
// and the tenant client are complements, so there is no session that can open
// both and none that opens either by accident.

function session(user: Partial<Session['user']>): Session {
  return {
    user: { id: 'u1', name: 'X', email: 'x@y.com', role: 'DESIGNER', firmId: 'firm-1', ...user },
    expires: '2999-01-01T00:00:00.000Z',
  } as Session;
}

const superAdmin = session({ role: 'SUPER_ADMIN', firmId: null });
const admin = session({ role: 'ADMIN', firmId: 'firm-1' });
const designer = session({ role: 'DESIGNER', firmId: 'firm-1' });

describe('getPlatformDb', () => {
  it('returns a client for the platform operator', () => {
    expect(getPlatformDb(superAdmin).firm).toBeDefined();
  });

  // A firm ADMIN is the most privileged role inside a firm and still has no
  // business reading other firms' rows. This is the check that says so.
  it('refuses a firm ADMIN', () => {
    expect(() => getPlatformDb(admin)).toThrow(/platform operator/i);
  });

  it('refuses a DESIGNER', () => {
    expect(() => getPlatformDb(designer)).toThrow(/platform operator/i);
  });

  it('refuses a signed-out session', () => {
    expect(() => getPlatformDb(null)).toThrow(/platform operator/i);
    expect(() => getPlatformDb(undefined)).toThrow(/platform operator/i);
  });

  // A role this app doesn't issue must not be waved through — failing closed
  // applies to unrecognized input, not just to known-bad input.
  it('refuses an unrecognized role', () => {
    expect(() => getPlatformDb(session({ role: 'OWNER' as never }))).toThrow(/platform operator/i);
  });
});

describe('the platform and tenant clients are complements', () => {
  it('no session can open both doors', () => {
    for (const s of [superAdmin, admin, designer, null]) {
      const platform = (() => {
        try {
          getPlatformDb(s);
          return true;
        } catch {
          return false;
        }
      })();
      const tenant = (() => {
        try {
          getTenantDb(s);
          return true;
        } catch {
          return false;
        }
      })();

      expect(platform && tenant, 'a session reached both the platform and a tenant').toBe(false);
    }
  });

  it('the platform operator is exactly the session the tenant client refuses', () => {
    expect(() => getTenantDb(superAdmin)).toThrow();
    expect(() => getPlatformDb(superAdmin)).not.toThrow();
  });
});
