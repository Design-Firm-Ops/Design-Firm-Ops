import { describe, it, expect } from 'vitest';
import { FIRM_STATUSES } from '@/lib/domain';
import { canTransition, allowedTransitions, firmActionsFor } from '@/lib/firmStatus';

// The transition table is a lockout switch: getting it wrong either strands a
// firm in a state it can't leave, or lets the console flip one it shouldn't.
// So it's asserted exhaustively — every from/to pair, not just the happy ones.

const LEGAL: Record<string, string[]> = {
  TRIAL: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
  ACTIVE: ['SUSPENDED', 'CANCELED'],
  SUSPENDED: ['ACTIVE', 'CANCELED'],
  CANCELED: ['ACTIVE'],
};

describe('canTransition', () => {
  it('agrees with the table for every pair', () => {
    for (const from of FIRM_STATUSES) {
      for (const to of FIRM_STATUSES) {
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(LEGAL[from].includes(to));
      }
    }
  });

  // A status change to the status it already has is a no-op, and treating it
  // as legal would write an audit record for something that didn't happen.
  it('refuses a move to the same status', () => {
    for (const status of FIRM_STATUSES) {
      expect(canTransition(status, status), status).toBe(false);
    }
  });

  it('never returns to TRIAL', () => {
    for (const from of FIRM_STATUSES) {
      expect(canTransition(from, 'TRIAL'), from).toBe(false);
    }
  });

  // Every firm must be able to get out of wherever it is — a state with no
  // exit is a firm the console can't help.
  it('leaves no status without an exit', () => {
    for (const status of FIRM_STATUSES) {
      expect(allowedTransitions(status).length, `${status} is a dead end`).toBeGreaterThan(0);
    }
  });

  // Cancel is reversible precisely because nothing is deleted.
  it('allows a canceled firm to be brought back', () => {
    expect(canTransition('CANCELED', 'ACTIVE')).toBe(true);
  });

  // The API route takes this from a request body.
  it('refuses values that are not statuses', () => {
    expect(canTransition('ACTIVE', 'DELETED' as never)).toBe(false);
    expect(canTransition('NOPE' as never, 'ACTIVE')).toBe(false);
    expect(canTransition('ACTIVE', '' as never)).toBe(false);
  });
});

describe('firmActionsFor', () => {
  it('offers exactly the legal moves', () => {
    for (const status of FIRM_STATUSES) {
      expect(firmActionsFor(status).map((a) => a.to)).toEqual(LEGAL[status]);
    }
  });

  // The word depends on where you're coming from: leaving a trial is
  // "activate", coming back from suspension is "reactivate".
  it('names the move from the caller’s point of view', () => {
    expect(firmActionsFor('TRIAL').find((a) => a.to === 'ACTIVE')?.label).toBe('Activate');
    expect(firmActionsFor('SUSPENDED').find((a) => a.to === 'ACTIVE')?.label).toBe('Reactivate');
    expect(firmActionsFor('ACTIVE').find((a) => a.to === 'SUSPENDED')?.label).toBe('Suspend');
    expect(firmActionsFor('ACTIVE').find((a) => a.to === 'CANCELED')?.label).toBe('Cancel');
  });

  it('marks the ones that cut off access', () => {
    const bySeverity = (status: 'ACTIVE' | 'TRIAL') =>
      Object.fromEntries(firmActionsFor(status).map((a) => [a.to, a.severe]));

    expect(bySeverity('ACTIVE')).toEqual({ SUSPENDED: true, CANCELED: true });
    expect(bySeverity('TRIAL').ACTIVE).toBe(false);
  });
});
