import { describe, it, expect, vi } from 'vitest';
import type { Session } from 'next-auth';
import { firmDenialFor } from '@/server/firmGate';

function session(user: Partial<Session['user']>): Session {
  return {
    user: { id: 'u1', name: 'X', email: 'x@y.com', role: 'DESIGNER', firmId: 'firm-1', ...user },
    expires: '2999-01-01T00:00:00.000Z',
  } as Session;
}

const dbWith = (status: string | null) => ({
  firm: { findUnique: vi.fn().mockResolvedValue(status ? { status, trialEndsAt: null } : null) },
});

describe('firmDenialFor', () => {
  it('allows a working firm', async () => {
    for (const status of ['ACTIVE', 'TRIAL']) {
      expect(await firmDenialFor(session({}), dbWith(status) as never), status).toBeNull();
    }
  });

  it('denies a suspended or canceled firm', async () => {
    expect(await firmDenialFor(session({}), dbWith('SUSPENDED') as never)).toBe('FIRM_SUSPENDED');
    expect(await firmDenialFor(session({}), dbWith('CANCELED') as never)).toBe('FIRM_CANCELED');
  });

  // The operator has no firm to judge, and denying them here would strand the
  // only account able to lift the suspension.
  it('never denies a session with no firm, and does not query for one', async () => {
    const db = dbWith('SUSPENDED');
    expect(await firmDenialFor(session({ role: 'SUPER_ADMIN', firmId: null }), db as never)).toBeNull();
    expect(db.firm.findUnique).not.toHaveBeenCalled();
  });

  it('never denies a signed-out request', async () => {
    const db = dbWith('SUSPENDED');
    expect(await firmDenialFor(null, db as never)).toBeNull();
    expect(db.firm.findUnique).not.toHaveBeenCalled();
  });

  // One indexed primary-key lookup, selecting one column — this runs on every
  // authenticated request, so the shape of the query is part of the contract.
  // One read serves both the gate and the trial banner, so the /app layout
  // doesn't ask for the same row twice on every page load.
  it('asks for the status and trial, by primary key, in one query', async () => {
    const db = dbWith('ACTIVE');
    await firmDenialFor(session({}), db as never);

    expect(db.firm.findUnique).toHaveBeenCalledTimes(1);
    expect(db.firm.findUnique).toHaveBeenCalledWith({
      where: { id: 'firm-1' },
      select: { status: true, trialEndsAt: true },
    });
  });

  it('allows through when the firm row has gone missing', async () => {
    expect(await firmDenialFor(session({}), dbWith(null) as never)).toBeNull();
  });
});
