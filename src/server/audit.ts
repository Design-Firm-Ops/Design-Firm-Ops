import type { Session } from 'next-auth';
import type { FirmStatus } from '@/lib/domain';
import { requireSuperAdmin } from '@/lib/tenant';

// The platform console's audit trail (DES-27; DES-30 adds the UI and the rest
// of the vocabulary).
//
// Every privileged action gets a record naming who did it, to which firm, and
// what changed. Written inside the same transaction as the change itself —
// an unlogged status change would be exactly the gap the acceptance criteria
// are asking us to close, and "we'll log it after" is how that gap appears.

/** Action names are dotted and stable — they're data, and DES-30 will query them. */
export const FIRM_STATUS_ACTIONS: Readonly<Record<FirmStatus, string>> = {
  ACTIVE: 'firm.activate',
  SUSPENDED: 'firm.suspend',
  CANCELED: 'firm.cancel',
  // Nothing transitions *to* TRIAL (see firmStatus.ts), but the map is total
  // so a new status can't silently fall through to an empty action name.
  TRIAL: 'firm.trial',
};

/** The slice of a client this needs — satisfied by both the platform client and a transaction. */
export interface AuditWriter {
  auditLog: {
    create(args: {
      data: {
        actorId: string;
        actorEmail: string;
        action: string;
        firmId: string;
        detail?: unknown;
      };
    }): Promise<unknown>;
  };
}

/**
 * Records a firm status change.
 *
 * Takes the session rather than an id so the actor cannot be mislabelled by a
 * caller, and re-asserts through `requireSuperAdmin` — an audit record whose
 * actor is wrong is worse than none, because it looks like evidence.
 */
export async function recordFirmStatusChange(
  db: AuditWriter,
  session: Session | null | undefined,
  change: { firmId: string; from: FirmStatus; to: FirmStatus }
): Promise<void> {
  const actorId = requireSuperAdmin(session);

  await db.auditLog.create({
    data: {
      actorId,
      actorEmail: session?.user?.email ?? '',
      action: FIRM_STATUS_ACTIONS[change.to],
      firmId: change.firmId,
      detail: { from: change.from, to: change.to },
    },
  });
}
