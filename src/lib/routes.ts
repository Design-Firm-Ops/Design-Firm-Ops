// Where a path sits in the route tree.
//
// Small, but shared by two places that must agree: middleware decides whether
// a session may load a path, and the nav decides which section looks selected.
// Both answer "is this path inside that section", and both get it wrong in the
// same way if written as a bare `startsWith` — `/admin` would claim
// `/administration`, and `/admin/firms` would claim `/admin/firms-archive`.

/** True when `pathname` is `base` or sits inside it — `/base` and `/base/…`, not `/basement`. */
export function isUnder(pathname: string | null | undefined, base: string): boolean {
  if (!pathname) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export const CONSOLE_HOME = '/admin';
export const APP_HOME = '/app/projects';
export const LOGIN = '/login';

/**
 * Where a session belongs when it hasn't asked for anywhere in particular:
 * after signing in, at `/`, or when it lands in the wrong area.
 *
 * A platform operator has no firm, so `/app` would bounce them off the gate in
 * `middleware.ts` — which it did, sending them back to the login form as a
 * signed-in user with nowhere to go. This function and that gate are two
 * halves of one rule, and `middleware.test.ts` pins that they agree: every
 * role is sent somewhere it is actually allowed.
 */
export function landingPathFor(role: string | null | undefined): string {
  if (!role) return LOGIN;
  return role === 'SUPER_ADMIN' ? CONSOLE_HOME : APP_HOME;
}
