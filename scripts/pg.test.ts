import { describe, it, expect } from 'vitest';
import { buildDatabaseUrl, isSafePgIdentifier } from './pg.mjs';

describe('buildDatabaseUrl', () => {
  it('builds a standard connection URL', () => {
    expect(
      buildDatabaseUrl({
        user: 'dfo_app',
        password: 'secret',
        host: 'localhost',
        port: '5432',
        database: 'design_firm_ops',
      })
    ).toBe('postgresql://dfo_app:secret@localhost:5432/design_firm_ops');
  });

  it('URL-encodes special characters in the credentials', () => {
    expect(
      buildDatabaseUrl({
        user: 'a b',
        password: 'p@ss:w/rd?',
        host: 'localhost',
        port: '5432',
        database: 'db',
      })
    ).toBe('postgresql://a%20b:p%40ss%3Aw%2Frd%3F@localhost:5432/db');
  });

  it('omits the password segment when there is no password (peer/trust auth)', () => {
    expect(
      buildDatabaseUrl({ user: 'postgres', password: '', host: 'db', port: '5432', database: 'x' })
    ).toBe('postgresql://postgres@db:5432/x');
  });
});

describe('isSafePgIdentifier', () => {
  it('accepts simple identifiers', () => {
    expect(isSafePgIdentifier('dfo_app')).toBe(true);
    expect(isSafePgIdentifier('_x1')).toBe(true);
    expect(isSafePgIdentifier('design_firm_ops')).toBe(true);
  });

  it('rejects injection attempts and invalid names', () => {
    expect(isSafePgIdentifier('1abc')).toBe(false); // leading digit
    expect(isSafePgIdentifier('a; DROP DATABASE x')).toBe(false);
    expect(isSafePgIdentifier('has-dash')).toBe(false);
    expect(isSafePgIdentifier('"quoted"')).toBe(false);
    expect(isSafePgIdentifier('')).toBe(false);
    expect(isSafePgIdentifier('a'.repeat(64))).toBe(false); // too long
  });
});
