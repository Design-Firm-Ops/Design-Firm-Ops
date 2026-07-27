import type { FirmStatus } from '@/lib/domain';

// Whether a firm's people may sign in, and what to tell them if not.
//
// `Firm.status` has existed since DES-23 and nothing read it: a suspended firm
// worked exactly like an active one. This module is where that stops being
// true, so it is pure and tested rather than a condition inside `authorize`.
//
// The login page imports the same vocabulary, so the code the server throws
// and the sentence the user reads can't drift apart.

export const FIRM_DENIAL_CODES = ['FIRM_SUSPENDED', 'FIRM_CANCELED'] as const;
export type FirmDenialCode = (typeof FIRM_DENIAL_CODES)[number];

/** Statuses that block sign-in, and the code each one reports. */
const DENIED: Partial<Record<FirmStatus, FirmDenialCode>> = {
  SUSPENDED: 'FIRM_SUSPENDED',
  CANCELED: 'FIRM_CANCELED',
};

/**
 * Why this firm's users may not sign in, or null if they may.
 *
 * A null status means the session belongs to no firm — the platform operator —
 * and is never denied here. Getting that wrong would lock out the one account
 * able to undo a suspension.
 *
 * Note this fails *open* for an unrecognized status, which is the opposite of
 * this codebase's usual instinct and deliberate: the function decides whether
 * to lock real customers out, and an unexpected value in our own column is a
 * bug on our side, not evidence against them. Only the named statuses block.
 */
export function loginDenialFor(status: FirmStatus | null | undefined): FirmDenialCode | null {
  if (!status) return null;
  return DENIED[status] ?? null;
}

const MESSAGES: Record<FirmDenialCode, string> = {
  FIRM_SUSPENDED:
    'This account is suspended. Please contact support to restore access.',
  FIRM_CANCELED:
    'This account has been canceled. Please contact support if you believe this is a mistake.',
};

/**
 * The sentence to show for a failed sign-in.
 *
 * Anything that isn't a firm-status code stays deliberately vague: a specific
 * message for a bad password would confirm which email addresses exist. The
 * firm-status messages are safe to be specific about only because the server
 * checks the password first — see `authorize` in src/server/auth.ts.
 */
export function signInErrorMessage(error: string | null | undefined): string {
  const code = FIRM_DENIAL_CODES.find((c) => c === error);
  return code ? MESSAGES[code] : 'Invalid email or password.';
}
