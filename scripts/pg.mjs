// Pure helpers for the setup script's Postgres provisioning. Kept in their
// own module (no side effects on import) so they can be unit-tested — the
// setup script itself runs `main()` on import and can't be imported safely.

/**
 * Build a `postgresql://` connection URL, URL-encoding the user and password
 * so credentials containing special characters (`@`, `:`, `/`, ...) don't
 * corrupt the URI. Password is optional (peer/trust auth).
 */
export function buildDatabaseUrl({ user, password, host, port, database }) {
  const enc = encodeURIComponent;
  const auth = password ? `${enc(user)}:${enc(password)}` : enc(user);
  return `postgresql://${auth}@${host}:${port}/${enc(database)}`;
}

/**
 * True when `name` is a Postgres identifier we're willing to interpolate into
 * DDL (a role or database name): a leading letter/underscore followed by
 * letters, digits, or underscores, at most 63 chars. Anything else is rejected
 * so we never quote/escape — and can't be used to inject SQL.
 */
export function isSafePgIdentifier(name) {
  return typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name);
}
