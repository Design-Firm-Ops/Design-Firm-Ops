import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_OFFERINGS,
  DEFAULT_FEE_STRUCTURES,
  DEFAULT_ITEM_TYPES,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_LEAD_BOARD,
} from '@/server/firmDefaults';

// These lists were copied out of migration SQL (DES-28). The migrations are
// what the *existing* firm actually received, so they are the reference: if
// these drift, every firm provisioned from now on quietly starts with
// something different from the one already in production, and nobody finds out
// until a screen is missing an option.
//
// Reading the SQL rather than restating it is the point — a test that repeated
// the list would only prove I can copy twice.

const MIGRATIONS = join('prisma', 'migrations');

function allMigrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((entry) => !entry.endsWith('.toml'))
    .map((dir) => {
      try {
        return readFileSync(join(MIGRATIONS, dir, 'migration.sql'), 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
}

const SQL = allMigrationSql();

/** Rows of a VALUES list for one table, as arrays of the quoted string literals. */
function insertedRows(table: string): string[][] {
  const rows: string[][] = [];

  for (const statement of SQL.split(';')) {
    if (!statement.includes(`INSERT INTO "${table}"`)) continue;

    for (const [, tuple] of statement.matchAll(/\(([^()]*)\)/g)) {
      // Skip the column list, which carries no string literals.
      const literals = [...tuple.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      if (literals.length > 1) rows.push(literals);
    }
  }
  return rows;
}

describe('firm defaults match what the original firm was given', () => {
  it('offerings', () => {
    // ('offering-furniture', 'Furniture', 0) — id, then name.
    const names = insertedRows('Offering').map((r) => r[1]);
    expect(names.length, 'no Offering inserts found — has the migration moved?').toBeGreaterThan(0);
    expect([...DEFAULT_OFFERINGS].sort()).toEqual([...new Set(names)].sort());
  });

  // This one caught a real discrepancy on its first run. The migration also
  // has an INSERT…SELECT that adds design-fee "Cost Plus" *only* for firms
  // that already had a cost-plus project — a backfill, not a default. It is
  // deliberately absent from DEFAULT_FEE_STRUCTURES, and this test only reads
  // the unconditional VALUES lists, so re-adding it would fail here.
  it('fee structures', () => {
    // ('feestruct-…', 'Fixed Fee', 'DESIGN_FEE', 0) — id, name, scope.
    const fromSql = insertedRows('FeeStructureOption').map((r) => `${r[2]}:${r[1]}`);
    expect(fromSql.length).toBeGreaterThan(0);

    const fromCode = DEFAULT_FEE_STRUCTURES.map((f) => `${f.scope}:${f.name}`);
    expect(fromCode.sort()).toEqual([...new Set(fromSql)].sort());
  });

  it('item types, including their tag prefixes', () => {
    // ('itemtype-…', 'Lighting', 'Chandelier', 'CD', 0) — id, category, name, prefix.
    const fromSql = insertedRows('ItemTypeOption').map((r) => `${r[1]}/${r[2]}/${r[3]}`);
    expect(fromSql.length).toBeGreaterThan(0);

    const fromCode = DEFAULT_ITEM_TYPES.map((t) => `${t.category}/${t.name}/${t.tagPrefix}`);
    expect(fromCode.sort()).toEqual([...new Set(fromSql)].sort());
  });

  it('the lead board', () => {
    const names = insertedRows('LeadBoard').map((r) => r[1]);
    expect(names).toContain(DEFAULT_LEAD_BOARD);
  });
});

describe('the defaults are internally sane', () => {
  // A duplicate would violate the per-firm unique index and fail provisioning
  // for *every* new firm — the sort of thing worth catching at the list.
  it('has no duplicate offerings, stages, or fee structures', () => {
    expect(new Set(DEFAULT_OFFERINGS).size).toBe(DEFAULT_OFFERINGS.length);
    expect(new Set(DEFAULT_PIPELINE_STAGES).size).toBe(DEFAULT_PIPELINE_STAGES.length);

    const fees = DEFAULT_FEE_STRUCTURES.map((f) => `${f.scope}:${f.name}`);
    expect(new Set(fees).size).toBe(fees.length);
  });

  // Item tags are generated from these prefixes, so a collision inside a
  // category would produce two item types that tag identically.
  it('has unique tag prefixes within each category', () => {
    const byCategory = new Map<string, string[]>();
    for (const type of DEFAULT_ITEM_TYPES) {
      byCategory.set(type.category, [...(byCategory.get(type.category) ?? []), type.tagPrefix]);
    }

    for (const [category, prefixes] of byCategory) {
      expect(new Set(prefixes).size, `${category} has duplicate tag prefixes`).toBe(prefixes.length);
    }
  });

  it('starts the pipeline with a lead stage and ends with an outcome', () => {
    expect(DEFAULT_PIPELINE_STAGES[0]).toMatch(/lead/i);
    expect(DEFAULT_PIPELINE_STAGES).toContain('Won');
    expect(DEFAULT_PIPELINE_STAGES).toContain('Lost');
  });
});
