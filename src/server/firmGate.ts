import type { Session } from 'next-auth';
import { prisma } from '@/server/prisma';
import { loginDenialFor, type FirmDenialCode } from '@/lib/firmAccess';
import type { FirmStatus } from '@/lib/domain';

// Suspension that takes effect now, rather than whenever a token happens to
// expire.
//
// Sessions are JWTs, so blocking sign-in alone would leave an already-signed-in
// user working for hours after their firm was suspended — which isn't really a
// suspension. This check runs on every authenticated request instead: one
// indexed primary-key lookup, against the same pure rule the login gate uses.

/** Only what this needs, so tests can pass a stub. */
type Db = Pick<typeof prisma, 'firm'>;

/** The firm facts every authenticated request needs: may they work, and are they on trial. */
export interface FirmGate {
  status: FirmStatus;
  trialEndsAt: Date | null;
}

/**
 * The session's firm, or null when there is none to load.
 *
 * One query for both the lifecycle gate and the trial banner — the /app layout
 * needs both on every page load, and asking twice for the same row would be a
 * second round trip for nothing.
 */
export async function loadFirmGate(
  session: Session | null | undefined,
  db: Db = prisma
): Promise<FirmGate | null> {
  const firmId = session?.user?.firmId;
  if (!firmId) return null;

  const firm = await db.firm.findUnique({
    where: { id: firmId },
    select: { status: true, trialEndsAt: true },
  });

  return firm ? { status: firm.status as FirmStatus, trialEndsAt: firm.trialEndsAt } : null;
}

/**
 * Why this session's firm may not be used right now, or null if it may.
 *
 * A session with no firm — the platform operator — has no firm status to be
 * judged by and is always allowed through here; `/admin` has its own gate.
 *
 * A firmId pointing at a firm that no longer exists returns no denial: firms
 * are never hard-deleted (DES-27 forbids it), and if one were, the tenant
 * client would find no rows to hand over anyway.
 */
export async function firmDenialFor(
  session: Session | null | undefined,
  db: Db = prisma
): Promise<FirmDenialCode | null> {
  return loginDenialFor((await loadFirmGate(session, db))?.status);
}
