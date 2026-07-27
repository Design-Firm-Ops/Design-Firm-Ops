import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The gap that let a real leak through.
//
// Page components don't use the tenant client. They call `src/server/queries/*`
// with a firmId, and those functions are *trusted* to apply it — nothing
// verified that they did. Two didn't: `listUsers` and `listDesigners` took a
// firmId and never used it, so /app/settings and /app/administration listed
// every user on the platform, the platform operator included.
//
// The isolation gate couldn't have caught it: every guard there is about the
// tenant client, and this code path deliberately bypasses it. So this file
// covers the other path — the one where scoping is a promise rather than a
// mechanism.
//
// A behavioural version of this runs in the isolation suite against real data,
// which is what actually proves a `where` works. This is the cheap check that
// fails in `npm test` without a database, and names the offender.

const QUERY_DIR = join('src', 'server', 'queries');

interface QueryFn {
  file: string;
  name: string;
  params: string;
  body: string;
}

/** Every exported function in the query modules, with its body. */
function queryFunctions(): QueryFn[] {
  const found: QueryFn[] = [];

  for (const entry of readdirSync(QUERY_DIR)) {
    if (!entry.endsWith('.ts') || entry.includes('.test.')) continue;

    const file = join(QUERY_DIR, entry);
    const src = readFileSync(file, 'utf8');

    for (const match of src.matchAll(/export (?:async )?function (\w+)\(([^)]*)\)/g)) {
      const start = match.index! + match[0].length;
      // A function's body runs to the next top-level export, or end of file.
      const next = src.indexOf('\nexport ', start);
      found.push({
        file,
        name: match[1],
        params: match[2],
        body: src.slice(start, next === -1 ? src.length : next),
      });
    }
  }
  return found;
}

const FUNCTIONS = queryFunctions();

/** Prisma calls in a body, e.g. `prisma.user.findMany`. */
const prismaCalls = (body: string) => [...body.matchAll(/prisma\.(\w+)\.(\w+)/g)].map((m) => m[0]);

describe('firm-scoped queries', () => {
  it('finds the query modules at all', () => {
    // Guards against this whole file silently passing because a rename moved
    // the directory — an empty list would otherwise satisfy every check below.
    expect(FUNCTIONS.length, 'no exported query functions found — has the path changed?').toBeGreaterThan(5);
  });

  // The exact bug: a firmId parameter that is accepted and then ignored.
  it('use the firmId they are given', () => {
    const ignored = FUNCTIONS.filter((fn) => fn.params.includes('firmId') && !fn.body.includes('firmId')).map(
      (fn) => `${fn.file}:${fn.name}`
    );

    expect(
      ignored,
      'These take a firmId and never use it, so they return every firm’s rows. ' +
        'Add `where: { firmId }`.'
    ).toEqual([]);
  });

  // The other shape of the same bug: a query that doesn't even ask which firm.
  it('every query that reads the database asks which firm', () => {
    const unscoped = FUNCTIONS.filter((fn) => prismaCalls(fn.body).length > 0)
      .filter((fn) => !fn.params.includes('firmId'))
      .map((fn) => `${fn.file}:${fn.name}`);

    expect(
      unscoped,
      'These query the database without taking a firmId. Every read here is ' +
        'firm-facing: take the firm explicitly and filter by it.'
    ).toEqual([]);
  });

  // `where` is what actually scopes a query; a firmId used only in a `select`
  // or an `orderBy` would satisfy the first check while leaking everything.
  it('put the firmId in a where clause', () => {
    const notFiltered = FUNCTIONS.filter((fn) => prismaCalls(fn.body).length > 0)
      .filter((fn) => !/where:\s*\{[^}]*firmId|where:\s*\w+/.test(fn.body))
      .map((fn) => `${fn.file}:${fn.name}`);

    expect(notFiltered, 'These mention firmId but not inside a `where`.').toEqual([]);
  });
});
