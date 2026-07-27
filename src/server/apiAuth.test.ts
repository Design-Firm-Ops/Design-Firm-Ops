import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireSession, requireAdmin, requireOperator } from '@/server/apiAuth';

const getServerSession = vi.fn();
const firmDenialFor = vi.fn().mockResolvedValue(null);
vi.mock('@/server/firmGate', () => ({ firmDenialFor: (...a: unknown[]) => firmDenialFor(...a) }));
vi.mock('next-auth', () => ({ getServerSession: () => getServerSession() }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

// The guard on every API route. A mistake here is an authorization hole, so
// both the allow and the deny paths are pinned.

beforeEach(() => {
  getServerSession.mockReset();
  firmDenialFor.mockReset().mockResolvedValue(null);
});

describe('requireSession', () => {
  it('passes the session through when signed in', async () => {
    const session = { user: { id: 'u1', role: 'DESIGNER' } };
    getServerSession.mockResolvedValue(session);

    const result = await requireSession();
    expect(result.session).toBe(session);
    expect(result.unauthorized).toBeNull();
  });

  it('returns a 401 when signed out', async () => {
    getServerSession.mockResolvedValue(null);

    const { session, unauthorized } = await requireSession();
    expect(session).toBeNull();
    expect(unauthorized?.status).toBe(401);
    expect(await unauthorized!.json()).toEqual({ error: 'Unauthorized' });
  });
});

describe('requireAdmin', () => {
  it('admits an admin', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN' } });

    const { session, unauthorized } = await requireAdmin();
    expect(session).not.toBeNull();
    expect(unauthorized).toBeNull();
  });

  it('rejects a signed-in designer with 403, not 401', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u1', role: 'DESIGNER' } });

    const { session, unauthorized } = await requireAdmin();
    // The distinction matters: 401 means "log in", 403 means "you can't".
    expect(unauthorized?.status).toBe(403);
    expect(await unauthorized!.json()).toEqual({ error: 'Administrator access required' });
    expect(session).toBeNull();
  });

  it('rejects a signed-out request with 401', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await requireAdmin()).unauthorized?.status).toBe(401);
  });

  it('rejects an unrecognized role rather than defaulting to allow', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u3', role: 'SUPERUSER' } });
    expect((await requireAdmin()).unauthorized?.status).toBe(403);
  });
});

// DES-27: a suspended firm is refused on every request, not only at sign-in.
describe('firm lifecycle is enforced per request', () => {
  const firmUser = { user: { id: 'u1', role: 'DESIGNER', firmId: 'firm-1' } };

  it('refuses a suspended firm with an explanation', async () => {
    getServerSession.mockResolvedValue(firmUser);
    firmDenialFor.mockResolvedValue('FIRM_SUSPENDED');

    const { session, unauthorized } = await requireSession();
    expect(session).toBeNull();
    expect(unauthorized?.status).toBe(403);
    await expect(unauthorized?.json()).resolves.toMatchObject({ error: expect.stringMatching(/suspended/i) });
  });

  // Otherwise a firm admin would keep full access to a suspended firm.
  it('applies to requireAdmin too', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', firmId: 'firm-1' } });
    firmDenialFor.mockResolvedValue('FIRM_CANCELED');

    expect((await requireAdmin()).unauthorized?.status).toBe(403);
  });
});

describe('requireOperator', () => {
  it('admits the platform operator', async () => {
    const session = { user: { id: 'op', role: 'SUPER_ADMIN', firmId: null } };
    getServerSession.mockResolvedValue(session);

    const result = await requireOperator();
    expect(result.session).toBe(session);
  });

  it('refuses firm users, including firm admins', async () => {
    for (const role of ['ADMIN', 'DESIGNER']) {
      getServerSession.mockResolvedValue({ user: { id: 'u1', role, firmId: 'firm-1' } });
      expect((await requireOperator()).unauthorized?.status, role).toBe(403);
    }
  });

  it('refuses a signed-out request', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await requireOperator()).unauthorized?.status).toBe(401);
  });

  // The operator lifts suspensions, so gating them on a firm status would be
  // circular — and they have no firm to be gated on in the first place.
  it('does not consult firm status', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'op', role: 'SUPER_ADMIN', firmId: null } });
    await requireOperator();
    expect(firmDenialFor).not.toHaveBeenCalled();
  });
});
