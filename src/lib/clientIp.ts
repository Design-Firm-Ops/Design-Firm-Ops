// Best-effort client IP, for rate-limiting only.
//
// Behind a proxy the socket address is the proxy's, so the client's address
// arrives in a header — and headers are attacker-controlled unless a trusted
// proxy is rewriting them. That is fine for the one thing this is used for:
// making unlimited sign-ups slightly inconvenient. It must never be used for
// authorization, audit attribution, or anything an attacker would benefit from
// spoofing.
//
// `x-forwarded-for` is a list, oldest first; the leftmost entry is the client
// as reported by the first proxy.

export const UNKNOWN_IP = 'unknown';

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return headers.get('x-real-ip')?.trim() || UNKNOWN_IP;
}
