import { describe, it, expect, vi } from 'vitest';
import type { Session } from 'next-auth';
import { FIRM_STATUSES } from '@/lib/domain';
import { recordFirmStatusChange, FIRM_STATUS_ACTIONS } from '@/server/audit';

const operator = {
  user: { id: 'op-1', email: 'operator@example.test', role: 'SUPER_ADMIN', firmId: null },
} as Session;

const writer = () => ({ auditLog: { create: vi.fn().mockResolvedValue({}) } });

describe('recordFirmStatusChange', () => {
  it('records who did what, to which firm, and what changed', async () => {
    const db = writer();
    await recordFirmStatusChange(db, operator, { firmId: 'firm-1', from: 'ACTIVE', to: 'SUSPENDED' });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'op-1',
        actorEmail: 'operator@example.test',
        action: 'firm.suspend',
        firmId: 'firm-1',
        detail: { from: 'ACTIVE', to: 'SUSPENDED' },
      },
    });
  });

  it('names the action after the destination', async () => {
    for (const to of ['ACTIVE', 'SUSPENDED', 'CANCELED'] as const) {
      const db = writer();
      await recordFirmStatusChange(db, operator, { firmId: 'f', from: 'TRIAL', to });
      expect(db.auditLog.create.mock.calls[0][0].data.action).toBe(FIRM_STATUS_ACTIONS[to]);
    }
  });

  // An audit record with the wrong actor is worse than no record, because it
  // reads as evidence. The actor comes from the session, never from a caller.
  it('refuses to write on behalf of anyone but the operator', async () => {
    const db = writer();
    const firmAdmin = { user: { id: 'u1', role: 'ADMIN', firmId: 'firm-1' } } as Session;

    await expect(
      recordFirmStatusChange(db, firmAdmin, { firmId: 'firm-1', from: 'ACTIVE', to: 'SUSPENDED' })
    ).rejects.toThrow(/platform operator/i);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses a signed-out caller', async () => {
    const db = writer();
    await expect(
      recordFirmStatusChange(db, null, { firmId: 'f', from: 'ACTIVE', to: 'SUSPENDED' })
    ).rejects.toThrow();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  // A status with no action name would write an empty string and quietly
  // produce unqueryable records.
  it('has an action name for every status the schema can hold', () => {
    for (const status of FIRM_STATUSES) {
      expect(FIRM_STATUS_ACTIONS[status], status).toMatch(/^firm\.\w+$/);
    }
  });
});
