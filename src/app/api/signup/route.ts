import { NextRequest, NextResponse } from 'next/server';
import { provisionFirm, EmailTakenError } from '@/server/provisionFirm';
import { parseBody, conflict } from '@/lib/apiRoute';
import { signupSchema } from '@/lib/validation';
import { createRateLimiter } from '@/lib/rateLimit';
import { clientIpFrom } from '@/lib/clientIp';

// Public sign-up — the app's only unauthenticated write.
//
// Everything else is behind the middleware gate or a tokenized portal link.
// This one has no tenant to scope to, because it is the thing that creates
// one; what replaces scoping is that it does nothing except call
// `provisionFirm`, which stamps everything to the firm it just made, in a
// single transaction. `isolationGuards.test.ts` enforces that this route
// reaches the database no other way.

const SIGNUPS_PER_HOUR = 5;

// Module scope, so the window survives between requests in a process. Its
// limits are stated in src/lib/rateLimit.ts — in-memory and per-instance, so
// this slows a casual script rather than stopping a determined attacker.
const limiter = createRateLimiter({ limit: SIGNUPS_PER_HOUR, windowMs: 60 * 60 * 1000 });

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSeconds } = limiter.check(clientIpFrom(req.headers));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many sign-ups from this address. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }

  const { data, response } = await parseBody(req, signupSchema);
  if (response) return response;

  try {
    const { firmId, slug } = await provisionFirm({
      firmName: data.firmName,
      adminName: data.adminName,
      email: data.email,
      password: data.password,
      plan: data.plan,
    });

    // Deliberately no session: the client signs in with the credentials it
    // just set, so there is exactly one path that mints a session and it stays
    // the one with the firm-status gate on it (DES-27).
    return NextResponse.json({ firmId, slug }, { status: 201 });
  } catch (error) {
    // Sign-up has to say an address is taken, or the form is unusable. That
    // does leak which emails have accounts — the opposite of the care taken
    // over the login gate in DES-27, and a deliberate trade-off rather than an
    // oversight: you cannot let someone register without telling them whether
    // registration succeeded.
    if (error instanceof EmailTakenError) return conflict(error.message);
    throw error;
  }
}
