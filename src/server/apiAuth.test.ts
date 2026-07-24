import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireSession, requireAdmin } from '@/server/apiAuth';

const getServerSession = vi.fn();
vi.mock('next-auth', () => ({ getServerSession: () => getServerSession() }));
vi.mock('@/server/auth', () => ({ authOptions: {} }));

// The guard on every API route. A mistake here is an authorization hole, so
// both the allow and the deny paths are pinned.

beforeEach(() => {
  getServerSession.mockReset();
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
