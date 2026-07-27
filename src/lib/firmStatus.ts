import { FIRM_STATUSES, type FirmStatus } from '@/lib/domain';

// Which lifecycle moves the console may make.
//
// A table rather than logic scattered across buttons, because this is a
// lockout switch: the wrong entry either strands a firm in a state it can't
// leave, or lets an operator flip one they shouldn't. Pure, so the API route
// and the UI enforce and display the *same* rule — the route can't trust the
// UI, since it's reachable directly.

/** Legal destinations from each status. A status is never a destination for itself. */
export const FIRM_TRANSITIONS: Readonly<Record<FirmStatus, readonly FirmStatus[]>> = {
  // A trial either converts or ends.
  TRIAL: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
  ACTIVE: ['SUSPENDED', 'CANCELED'],
  SUSPENDED: ['ACTIVE', 'CANCELED'],
  // Reversible on purpose: cancelling never deletes anything (the issue
  // forbids it), so bringing a firm back is just another status flip.
  CANCELED: ['ACTIVE'],
};

function isFirmStatusValue(value: unknown): value is FirmStatus {
  return typeof value === 'string' && (FIRM_STATUSES as readonly string[]).includes(value);
}

export function allowedTransitions(from: FirmStatus): readonly FirmStatus[] {
  return FIRM_TRANSITIONS[from] ?? [];
}

/**
 * Whether `from → to` is a move the console may make.
 *
 * Nothing returns to TRIAL — a trial is where a firm starts, not somewhere it
 * goes back to. A move to the current status is refused as well: it changes
 * nothing, and treating it as legal would write an audit record for an event
 * that never happened.
 */
export function canTransition(from: FirmStatus, to: FirmStatus): boolean {
  if (!isFirmStatusValue(from) || !isFirmStatusValue(to)) return false;
  return allowedTransitions(from).includes(to);
}

export interface FirmAction {
  to: FirmStatus;
  /** Named from the operator's point of view — see `label` below. */
  label: string;
  /** True when the move cuts a firm's users off, so the UI can treat it as destructive. */
  severe: boolean;
}

/**
 * The verb for a move, which depends on where you're coming from: leaving a
 * trial is "Activate", while returning from suspension is "Reactivate".
 */
function label(from: FirmStatus, to: FirmStatus): string {
  if (to === 'ACTIVE') return from === 'TRIAL' ? 'Activate' : 'Reactivate';
  return to === 'SUSPENDED' ? 'Suspend' : 'Cancel';
}

/** The actions the console should offer for a firm in `from`. */
export function firmActionsFor(from: FirmStatus): FirmAction[] {
  return allowedTransitions(from).map((to) => ({
    to,
    label: label(from, to),
    severe: to === 'SUSPENDED' || to === 'CANCELED',
  }));
}
