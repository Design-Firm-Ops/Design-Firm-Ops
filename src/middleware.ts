import { withAuth } from 'next-auth/middleware';

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

/** True when `pathname` is inside `base` — matches `/base` and `/base/...`, not `/basement`. */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

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

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token, req }) => isAuthorizedFor(req.nextUrl.pathname, token?.role),
  },
});

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
