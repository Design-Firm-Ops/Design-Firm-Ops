import { describe, it, expect } from 'vitest';
import { isSelfDeactivation, SELF_DEACTIVATION_MESSAGE } from '@/lib/userAdmin';

describe('isSelfDeactivation', () => {
  it('catches deactivating yourself', () => {
    expect(isSelfDeactivation('u1', 'u1', { active: false })).toBe(true);
  });

  it('allows deactivating someone else', () => {
    expect(isSelfDeactivation('u1', 'u2', { active: false })).toBe(false);
  });

  // Only deactivation is self-forbidden. Editing your own name, or being
  // reactivated, is not this rule's business.
  it('does not interfere with other updates to your own account', () => {
    expect(isSelfDeactivation('u1', 'u1', {})).toBe(false);
    expect(isSelfDeactivation('u1', 'u1', { active: true })).toBe(false);
  });

  // The route's auth guard runs first, so this shouldn't happen — but a rule
  // that can't identify the actor must not conclude "not self".
  it('refuses when the actor is unknown', () => {
    expect(isSelfDeactivation(null, 'u1', { active: false })).toBe(true);
    expect(isSelfDeactivation(undefined, 'u1', { active: false })).toBe(true);
    expect(isSelfDeactivation('', 'u1', { active: false })).toBe(true);
  });

  it('has a message that says what to do about it', () => {
    expect(SELF_DEACTIVATION_MESSAGE).toMatch(/your own account/i);
  });
});
