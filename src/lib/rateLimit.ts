// A small fixed-window rate limiter.
//
// Built for one caller: `POST /api/signup`, the app's only unauthenticated
// write. Its honest limits are worth stating plainly, because a limiter that
// is trusted for more than it does is worse than none:
//
//   - **In-memory and per-process.** Several instances mean several windows,
//     and a restart forgets everything. It slows a casual script; it is not a
//     WAF and won't stop a distributed or determined attacker.
//   - **Keyed by whatever the caller passes.** For sign-up that's a client IP
//     taken from proxy headers, which a client can influence.
//
// Pure apart from the clock, which is injected, so the window behaviour is
// testable without waiting for real time to pass.

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — surfaced to the caller as a retry hint. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** Injected so tests can move time deliberately rather than sleeping. */
  now?: () => number;
}

/**
 * A fixed-window limiter allowing `limit` calls per `windowMs` per key.
 *
 * Fixed rather than sliding on purpose: it's a handful of lines, and the
 * burst-at-a-boundary weakness doesn't matter when the goal is "not unlimited"
 * rather than a precise quota.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimitOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const at = now();
      const cutoff = at - windowMs;

      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        const resetsAt = recent[0] + windowMs;
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - at) / 1000)) };
      }

      recent.push(at);
      hits.set(key, recent);

      // Keys with nothing left in the window are dropped as they're touched,
      // so an unbounded stream of distinct keys doesn't grow the map forever.
      if (hits.size > 10_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => t <= cutoff)) hits.delete(k);
        }
      }

      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
