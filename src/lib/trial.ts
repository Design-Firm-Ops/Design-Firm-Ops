// How long a trial lasts, and how much of it is left.
//
// Pure, with `now` injected, so the boundaries are tested by moving the clock
// rather than by waiting. The banner and the provisioning step both read from
// here, so "14 days" has one definition.

/** Length of a new firm's trial. Kept in step with the backfill in the DES-28 trial migration. */
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a trial starting at `startedAt` runs out. */
export function trialEndFor(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export interface TrialStatus {
  endsAt: Date;
  expired: boolean;
  /**
   * Whole days left, rounded up, so the final hours read "1 day left" rather
   * than "0 days left" — which would look like the trial had already ended.
   * Zero once expired.
   */
  daysRemaining: number;
}

/**
 * The state of a trial, or null when there isn't one to report.
 *
 * Null rather than a zero-value object: a firm with no trial end date is not
 * "a trial with nothing left", and the caller should show nothing at all.
 */
export function trialStatus(trialEndsAt: Date | null | undefined, now: Date): TrialStatus | null {
  if (!trialEndsAt) return null;

  const remaining = trialEndsAt.getTime() - now.getTime();
  const expired = remaining <= 0;

  return {
    endsAt: trialEndsAt,
    expired,
    daysRemaining: expired ? 0 : Math.ceil(remaining / DAY_MS),
  };
}

/** How the banner phrases it. */
export function trialMessage(status: TrialStatus): string {
  if (status.expired) return 'Your free trial has ended.';

  const days = status.daysRemaining;
  return `${days} ${days === 1 ? 'day' : 'days'} left in your free trial.`;
}
