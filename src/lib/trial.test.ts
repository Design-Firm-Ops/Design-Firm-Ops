import { describe, it, expect } from 'vitest';
import { trialStatus, trialEndFor, trialMessage, TRIAL_DAYS } from '@/lib/trial';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-07-01T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe('trialEndFor', () => {
  it('runs for the standard length', () => {
    const end = trialEndFor(at('2026-07-01T00:00:00Z'));
    expect(end.toISOString()).toBe('2026-07-15T00:00:00.000Z');
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe('trialStatus', () => {
  it('counts whole days remaining', () => {
    expect(trialStatus(days(14), NOW)?.daysRemaining).toBe(14);
    expect(trialStatus(days(3), NOW)?.daysRemaining).toBe(3);
  });

  // Rounded up, so the last hours don't read as "0 days left" — which would
  // look like the trial had already ended.
  it('rounds a part-day up', () => {
    expect(trialStatus(days(2.4), NOW)?.daysRemaining).toBe(3);
    expect(trialStatus(days(0.1), NOW)?.daysRemaining).toBe(1);
  });

  it('is expired at and after the end', () => {
    expect(trialStatus(NOW, NOW)?.expired).toBe(true);
    expect(trialStatus(days(-1), NOW)?.expired).toBe(true);
    expect(trialStatus(days(1), NOW)?.expired).toBe(false);
  });

  it('reports no days remaining once expired', () => {
    expect(trialStatus(days(-5), NOW)?.daysRemaining).toBe(0);
  });

  // A firm with no trial date isn't "a trial with nothing left" — there is
  // nothing to show, and the banner must not appear.
  it('is null when there is no trial', () => {
    expect(trialStatus(null, NOW)).toBeNull();
    expect(trialStatus(undefined, NOW)).toBeNull();
  });
});

describe('trialMessage', () => {
  it('counts down', () => {
    expect(trialMessage(trialStatus(days(14), NOW)!)).toBe('14 days left in your free trial.');
    expect(trialMessage(trialStatus(days(3), NOW)!)).toMatch(/^3 days left/);
  });

  it('says day, singular, on the last one', () => {
    expect(trialMessage(trialStatus(days(0.5), NOW)!)).toBe('1 day left in your free trial.');
  });

  // Access isn't cut off when a trial ends, so the copy must not imply it is.
  it('states the end plainly without threatening lockout', () => {
    const message = trialMessage(trialStatus(days(-1), NOW)!);
    expect(message).toBe('Your free trial has ended.');
    expect(message).not.toMatch(/locked|suspend|lose access|disabled/i);
  });
});
