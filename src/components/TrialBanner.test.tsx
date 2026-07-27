import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test';
import TrialBanner from './TrialBanner';

const NOW = new Date('2026-07-01T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const render = (props: Partial<Parameters<typeof TrialBanner>[0]> = {}) =>
  renderWithProviders(
    <TrialBanner status="TRIAL" trialEndsAt={inDays(9)} now={NOW} {...props} />
  );

describe('TrialBanner', () => {
  it('counts down the trial', () => {
    render();
    expect(screen.getByRole('status')).toHaveTextContent('9 days left in your free trial.');
  });

  it('says so when the trial has ended', () => {
    render({ trialEndsAt: inDays(-2) });
    expect(screen.getByRole('status')).toHaveTextContent('Your free trial has ended.');
  });

  // A firm that has converted, been suspended or cancelled is not on trial —
  // and a stale countdown on a paying firm's screen would be worse than none.
  it('shows nothing for a firm that is not on trial', () => {
    for (const status of ['ACTIVE', 'SUSPENDED', 'CANCELED']) {
      const { unmount } = render({ status });
      expect(screen.queryByRole('status'), status).toBeNull();
      unmount();
    }
  });

  it('shows nothing when there is no trial date', () => {
    render({ trialEndsAt: null });
    expect(screen.queryByRole('status')).toBeNull();
  });

  // Nothing actually cuts access off when a trial ends, so the banner must not
  // suggest it does.
  it('does not threaten a lockout it cannot carry out', () => {
    render({ trialEndsAt: inDays(-2) });
    expect(screen.getByRole('status').textContent).not.toMatch(/locked|suspend|lose access|disabled/i);
  });

  it('is honest that no payment has been taken', () => {
    render();
    expect(screen.getByRole('status')).toHaveTextContent(/nothing has been charged/i);
  });
});
