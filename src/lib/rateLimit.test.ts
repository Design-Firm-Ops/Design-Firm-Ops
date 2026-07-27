import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '@/lib/rateLimit';

// Time is injected, so the window is tested by moving the clock rather than
// sleeping.
function limiter(limit = 3, windowMs = 60_000) {
  let clock = 1_000_000;
  return {
    limiter: createRateLimiter({ limit, windowMs, now: () => clock }),
    advance: (ms: number) => (clock += ms),
  };
}

describe('createRateLimiter', () => {
  it('allows up to the limit, then refuses', () => {
    const { limiter: rl } = limiter(3);
    for (let i = 0; i < 3; i++) expect(rl.check('ip').allowed, `call ${i + 1}`).toBe(true);
    expect(rl.check('ip').allowed).toBe(false);
  });

  it('counts each key separately', () => {
    const { limiter: rl } = limiter(1);
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('b').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(false);
  });

  it('lets the caller back in once the window passes', () => {
    const { limiter: rl, advance } = limiter(1, 60_000);
    expect(rl.check('ip').allowed).toBe(true);
    expect(rl.check('ip').allowed).toBe(false);

    advance(59_000);
    expect(rl.check('ip').allowed, 'let in early').toBe(false);

    advance(2_000);
    expect(rl.check('ip').allowed).toBe(true);
  });

  it('reports how long to wait', () => {
    const { limiter: rl, advance } = limiter(1, 60_000);
    rl.check('ip');
    expect(rl.check('ip').retryAfterSeconds).toBe(60);

    advance(30_000);
    expect(rl.check('ip').retryAfterSeconds).toBe(30);
  });

  // A retry hint of 0 reads as "try again now", which would be a lie.
  it('never suggests retrying immediately', () => {
    const { limiter: rl, advance } = limiter(1, 60_000);
    rl.check('ip');
    advance(59_999);
    expect(rl.check('ip').retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  // Refused calls must not extend the window, or one blocked client could keep
  // itself blocked forever by retrying.
  it('does not count refused calls against the window', () => {
    const { limiter: rl, advance } = limiter(1, 60_000);
    rl.check('ip');
    for (let i = 0; i < 20; i++) rl.check('ip');

    advance(61_000);
    expect(rl.check('ip').allowed).toBe(true);
  });
});
