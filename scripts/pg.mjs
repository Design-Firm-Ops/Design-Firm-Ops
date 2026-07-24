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

/**
 * SQL that creates the app's login role, or updates it in place if it already
 * exists. One idempotent `DO` block, so it's safe to re-run.
 *
 * The role gets **CREATEDB**. That isn't for the app — it's for
 * `prisma migrate dev`, which creates and drops a temporary "shadow database"
 * on every run to detect schema drift. Without it, migrations fail with:
 *
 *   Error: P3014  Prisma Migrate could not create the shadow database.
 *   ERROR: permission denied to create database
 *
 * On a managed Postgres where CREATEDB can't be granted, set
 * SHADOW_DATABASE_URL instead and point it at a second database you created
 * by hand — see .env.example.
 *
 * The ALTER branch matters as much as the CREATE one: it repairs a role that
 * an earlier version of this script created without CREATEDB.
 *
 * `appUser` is interpolated into DDL, so it must be a safe identifier —
 * this throws rather than quoting/escaping it.
 */
export function buildRoleSql({ appUser, appPassword }) {
  if (!isSafePgIdentifier(appUser)) {
    throw new Error(`Unsafe Postgres role name: ${JSON.stringify(appUser)}`);
  }
  const pw = String(appPassword).replace(/'/g, "''"); // escape for the SQL string literal
  return (
    `DO $$ BEGIN ` +
    `IF EXISTS (SELECT FROM pg_roles WHERE rolname = '${appUser}') THEN ` +
    `ALTER ROLE "${appUser}" WITH LOGIN CREATEDB PASSWORD '${pw}'; ` +
    `ELSE ` +
    `CREATE ROLE "${appUser}" LOGIN CREATEDB PASSWORD '${pw}'; ` +
    `END IF; END $$;`
  );
}
