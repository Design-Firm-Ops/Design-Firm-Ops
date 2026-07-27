import { describe, it, expect } from 'vitest';
import { FIRM_STATUSES } from '@/lib/domain';
import { loginDenialFor, signInErrorMessage, FIRM_DENIAL_CODES } from '@/lib/firmAccess';

describe('loginDenialFor', () => {
  it('lets a working firm in', () => {
    expect(loginDenialFor('ACTIVE')).toBeNull();
    expect(loginDenialFor('TRIAL')).toBeNull();
  });

  it('blocks a suspended or canceled firm', () => {
    expect(loginDenialFor('SUSPENDED')).toBe('FIRM_SUSPENDED');
    expect(loginDenialFor('CANCELED')).toBe('FIRM_CANCELED');
  });

  // The platform operator belongs to no firm, so there is no firm status to
  // deny them by. Getting this wrong locks the only account that could undo
  // the suspension out of the console.
  it('never blocks a session with no firm', () => {
    expect(loginDenialFor(null)).toBeNull();
    expect(loginDenialFor(undefined)).toBeNull();
  });

  // Fails *open* here, deliberately and unusually: this function decides
  // whether to lock real users out, and an unrecognized status is a bug in
  // our data, not evidence against the customer. The narrow allowlist of
  // blocking states is the safe direction.
  it('does not block on an unrecognized status', () => {
    expect(loginDenialFor('ARCHIVED' as never)).toBeNull();
  });

  it('classifies every status the schema can hold', () => {
    for (const status of FIRM_STATUSES) {
      const denial = loginDenialFor(status);
      expect(denial === null || FIRM_DENIAL_CODES.includes(denial), status).toBe(true);
    }
  });
});

describe('signInErrorMessage', () => {
  it('explains a suspended firm', () => {
    expect(signInErrorMessage('FIRM_SUSPENDED')).toMatch(/suspended/i);
  });

  it('explains a canceled firm', () => {
    expect(signInErrorMessage('FIRM_CANCELED')).toMatch(/canceled/i);
  });

  // Both messages must point somewhere, or a locked-out user has no move.
  it('tells the user who to contact', () => {
    for (const code of FIRM_DENIAL_CODES) {
      expect(signInErrorMessage(code)).toMatch(/support|administrator/i);
    }
  });

  // Anything else is a bad-credentials failure, and must stay vague: a
  // specific message here would confirm which emails exist.
  it('is deliberately vague about everything else', () => {
    for (const error of ['CredentialsSignin', 'Something', '', null, undefined]) {
      expect(signInErrorMessage(error)).toBe('Invalid email or password.');
    }
  });
});
