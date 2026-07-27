import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Harness for the tenant-isolation integration suite.
//
// These tests need a real Postgres — a mocked client can only prove the tenant
// extension *builds* the right query, not that the database refuses a
// cross-tenant read. That distinction is the whole point of this suite, so it
// runs against real rows or it doesn't run at all.
//
// It never touches the developer's database. The URL is derived from
// DATABASE_URL with a fixed `_isolation_test` suffix, and that database is
// dropped and recreated on every run.

const TEST_DB_SUFFIX = '_isolation_test';

/** The isolation database's URL, or null when no DATABASE_URL is configured. */
export function isolationDatabaseUrl(): string | null {
  const base = process.env.DATABASE_URL;
  if (!base) return null;

  try {
    const url = new URL(base);
    // Guard against ever pointing this at the real database.
    const name = url.pathname.replace(/^\//, '');
    if (!name || name.endsWith(TEST_DB_SUFFIX)) return url.toString();
    url.pathname = `/${name}${TEST_DB_SUFFIX}`;
    return url.toString();
  } catch {
    return null;
  }
}

/** Whether the integration matrix can run. */
export function canRunIsolationTests(): boolean {
  return isolationDatabaseUrl() !== null;
}

/**
 * Explains a skip loudly.
 *
 * A silently-skipped security gate reads exactly like a passing one, which is
 * the failure mode this suite exists to avoid — so when it can't run, it says
 * so in a way that's hard to miss in a log.
 */
export function skipReason(): string {
  return [
    '',
    '  ┌──────────────────────────────────────────────────────────────────┐',
    '  │  TENANT-ISOLATION SUITE SKIPPED — no DATABASE_URL configured.    │',
    '  │  These tests are the correctness gate for multi-tenancy and      │',
    '  │  prove nothing when skipped. CI must run them with a database.   │',
    '  └──────────────────────────────────────────────────────────────────┘',
    '',
  ].join('\n');
}

function adminUrlFor(testUrl: string): { adminUrl: string; dbName: string } {
  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, '');
  url.pathname = '/postgres';
  return { adminUrl: url.toString(), dbName };
}

/**
 * Creates a fresh isolation database and applies migrations to it.
 *
 * Dropped first so every run starts from a known-empty state — a fixture left
 * behind by a failed run must not be able to make the next one pass.
 */
export async function setupIsolationDatabase(): Promise<PrismaClient> {
  const testUrl = isolationDatabaseUrl();
  if (!testUrl) throw new Error('No DATABASE_URL — cannot set up the isolation database.');

  const { adminUrl, dbName } = adminUrlFor(testUrl);
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    // Terminate stragglers so DROP can't be blocked by an old connection.
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`
    );
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });

  const client = new PrismaClient({ datasources: { db: { url: testUrl } } });

  // Earlier migrations seed a default firm and its baseline lookups (a "Leads"
  // board, the offering list). Clear them so the fixture is the *only* data:
  // the matrix asserts that the two firms' rows account for every row in the
  // table, and a stray third firm would quietly break that accounting.
  // Deleting the Firm cascades to everything it owns.
  await client.firm.deleteMany({});

  return client;
}

export async function teardownIsolationDatabase(client: PrismaClient): Promise<void> {
  await client.$disconnect();
}
