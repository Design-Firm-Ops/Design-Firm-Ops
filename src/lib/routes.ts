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
