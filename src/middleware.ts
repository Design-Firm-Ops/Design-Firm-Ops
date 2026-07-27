import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isUnder, landingPathFor } from '@/lib/routes';

// Route gating.
//
// /app    — firm-facing. Members of a firm only.
// /admin  — the platform console. The single SUPER_ADMIN only.
// /portal — intentionally public: clients reach it via tokenized links, not
//           accounts, so it isn't in the matcher at all.
//
// The gate is deliberately *bidirectional* (plans/ADMIN_DASHBOARD.md §3.4).
// Keeping a SUPER_ADMIN out of /app matters as much as keeping firm users out
// of /admin: a super-admin has no firmId, so letting them load /app would hand
// them whichever firm the tenancy fallback resolves — that firm's projects,
// invoices and vendor credentials. Reaching firm data on a super-admin's
// behalf is impersonation (DES-#8), and it should have to be explicit rather
// than a side effect of visiting a URL.

/**
 * Whether a session with `role` may load `pathname`.
 *
 * Exported so the rule can be tested directly — the alternative is asserting on
 * middleware redirects, which tests Next's plumbing rather than our policy.
 */
export function isAuthorizedFor(pathname: string, role: string | null | undefined): boolean {
  // Unauthenticated: withAuth sends them to the sign-in page.
  if (!role) return false;

  if (isUnder(pathname, '/admin')) return role === 'SUPER_ADMIN';
  if (isUnder(pathname, '/app')) return role !== 'SUPER_ADMIN';

  // Anything else caught by the matcher is authenticated-only.
  return true;
}

// Two different failures, two different answers.
//
// *Signed out* is `authorized: false`, which withAuth turns into the login
// page with a callbackUrl — the normal flow.
//
// *Signed in, wrong area* used to take the same path, and that was a dead end:
// a super-admin was sent to /app after logging in, bounced off the gate, and
// landed back on the login form already signed in. So the session is
// authorized as far as withAuth is concerned, and this function redirects them
// to their own home instead.
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    if (isAuthorizedFor(req.nextUrl.pathname, role)) return NextResponse.next();

    return NextResponse.redirect(new URL(landingPathFor(role), req.url));
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      // Only "is there a session at all" — the area check happens above, so it
      // can redirect somewhere useful rather than to the sign-in page.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
