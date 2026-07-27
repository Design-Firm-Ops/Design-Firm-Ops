import { describe, it, expect, afterEach } from 'vitest';
import { isolationDatabaseUrl, canRunIsolationTests, skipReason } from '@/test/isolationDb';

// The harness decides two things that matter: whether the gate can run, and
// which database it runs against. The second is a safety property — it must
// never resolve to the developer's own database.

const ORIGINAL = process.env.DATABASE_URL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL;
});

describe('isolationDatabaseUrl', () => {
  it('derives a separate database from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/design_firm_ops';
    expect(isolationDatabaseUrl()).toBe('postgresql://u:p@localhost:5432/design_firm_ops_isolation_test');
  });

  // The safety property: whatever happens, the suite must not point at the
  // database someone is developing against — it drops and recreates its own.
  it('never returns the developer’s own database', () => {
    for (const url of [
      'postgresql://u:p@localhost:5432/design_firm_ops',
      'postgresql://u:p@db.example.com:5432/production',
      'postgresql://u:p@localhost:5432/anything',
    ]) {
      process.env.DATABASE_URL = url;
      expect(isolationDatabaseUrl()).not.toBe(url);
      expect(isolationDatabaseUrl()).toContain('_isolation_test');
    }
  });

  it('is idempotent when already pointed at the isolation database', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/foo_isolation_test';
    expect(isolationDatabaseUrl()).toContain('foo_isolation_test');
    expect(isolationDatabaseUrl()).not.toContain('_isolation_test_isolation_test');
  });

  it('preserves credentials, host, port and query parameters', () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@db.host:6543/app?schema=public&sslmode=require';
    const url = new URL(isolationDatabaseUrl()!);
    expect(url.username).toBe('user');
    expect(url.host).toBe('db.host:6543');
    expect(url.pathname).toBe('/app_isolation_test');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('returns null with no DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    expect(isolationDatabaseUrl()).toBeNull();
  });

  it('returns null for a malformed DATABASE_URL rather than guessing', () => {
    process.env.DATABASE_URL = 'not a url';
    expect(isolationDatabaseUrl()).toBeNull();
  });
});

describe('canRunIsolationTests', () => {
  it('is false without a database, so the suite skips instead of failing', () => {
    delete process.env.DATABASE_URL;
    expect(canRunIsolationTests()).toBe(false);
  });

  it('is true with one', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/x';
    expect(canRunIsolationTests()).toBe(true);
  });
});

describe('skipReason', () => {
  // A silently-skipped security gate reads exactly like a passing one. CI
  // greps for this text to turn a skip into a failure, so the wording is load
  // bearing, not decoration.
  it('says loudly that the gate did not run', () => {
    expect(skipReason()).toContain('TENANT-ISOLATION SUITE SKIPPED');
    expect(skipReason()).toMatch(/prove nothing when skipped/i);
  });
});
