# DES-31 — Tenant-isolation test suite (correctness gate)

**Linear:** [DES-31](https://linear.app/design-firm-ops/issue/DES-31) · milestone _Phase 3_ · **Urgent**
**Status:** ✅ implemented. See "What shipped" at the bottom.
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §4.9, §5 · pairs with DES-25 (merged)

This is the gate the `/admin` issues (DES-26–30) are blocked on. It only earns that role
if it would actually fail when isolation breaks.

## The problem with what exists today

DES-25 shipped `tenantDb.test.ts`, but it runs against a **mocked** Prisma — it proves
the extension builds the right `where` clause, not that the database refuses a
cross-tenant read. The genuine proof I ran during DES-25 (two firms, real Postgres,
cross-firm reads and deletes) was a throwaway script that was deleted.

So right now **nothing in the repo would catch a regression that reopens a cross-tenant
path.** That's the gap this issue closes.

## What actually guarantees isolation

The issue asks to assert that Firm A can never reach Firm B's rows "through **any**
route". Hand-writing 64 route tests would be enormous and mostly re-test Next plumbing.
There's a stronger and cheaper argument available, because DES-25 created a chokepoint:

1. **Every route goes through the tenant client** — verified: all 64 route files use
   `tenantContext`/`getTenantDb`; the only exception is the NextAuth handler, which
   touches auth, not tenant data. Lint enforces it.
2. **The tenant client isolates every model** — this is what the integration matrix
   proves, model by model.

(1) + (2) ⇒ no route can read another firm's rows. The suite should test both halves,
and — importantly — the places where that argument could break:

- **Nested writes bypass the extension.** `create({ data: { contacts: { create: [...] } } })`
  is one query, so `$allOperations` never sees the inner rows. Two live sites:
  `clients` (contacts) and `items/[id]/copy` (field values). If either passed a wrong
  `firmId`, nothing today would notice.
- **Raw SQL** would bypass it entirely. None exists (`$queryRaw`/`$executeRaw`: zero
  hits) — the suite should assert that stays true.
- **A new model without `firmId`** would be silently unscoped. Already guarded by a test
  added in DES-25; it moves into this suite.

## Proposed shape

### Layer 1 — pure checks in `src/lib` (no database)
Per the acceptance criterion that pure isolation checks be unit-testable. A new
`src/lib/isolation.ts` holding the invariants as real functions rather than assertions
buried in a test:

- `isTenantModel(name)` / the scoped-model list, derived from the schema.
- `assertScopedQuery(model, operation, args)` — given a query, is it firm-scoped? Usable
  both by tests and, later, by a dev-mode runtime check.
- The fails-closed predicate already in `requireFirmId`, re-exported through the same
  vocabulary.

### Layer 2 — integration matrix against real Postgres
The part that actually proves isolation. Two firms, each fully populated, then for
**every one of the 29 tenant models**:

- `findMany` returns only own-firm rows; the two firms' views are disjoint.
- `findUnique` on the other firm's id returns `null`.
- `update` / `delete` on the other firm's id affects nothing and leaves the row intact.
- `create` stamps the caller's firm and ignores a caller-supplied `firmId`.
- `count` / `aggregate` don't count across firms.

Plus the cases that aren't per-model:

- **Nested writes** — a nested create lands in the parent's firm.
- **Per-firm uniques** — both firms can hold an item tagged `LT-1`, an invoice
  `2506-001`, an offering "Lighting", a project type, a resource folder. (Named
  explicitly in the issue.)
- **Fails closed** — unauthenticated and `SUPER_ADMIN` sessions are refused.
- **`resolvePermissions`** — two firms with different Settings resolve differently.

### Layer 3 — the structural guards
- Every model carries `firmId` or is deliberately exempt (moved from `tenantDb.test.ts`).
- No route imports raw `prisma` (belt-and-braces with the lint rule, so it fails the
  suite too, not only lint).
- No `$queryRaw` / `$executeRaw` in `src/`.

## The open question: where does this run?

The acceptance criteria say "Extends the Vitest suite; `npm test` green" — but Layer 2
needs a real Postgres, and **there is no CI in this repo at all** (no
`.github/workflows`, nothing else). A gate that only ever runs on my machine isn't a
gate.

Options in the question below. My recommendation: a third Vitest project (`isolation`)
included in `npm test`, which **skips loudly** when no database is reachable and runs
fully when there is one — plus a GitHub Actions workflow with a Postgres service so it's
enforced on every PR. That keeps `npm test` green in a fresh clone while making the gate
real where it counts.

Skipping silently is the failure mode to avoid, so the suite prints why it skipped, and
CI asserts it actually executed rather than trusting a green tick.

## Test strategy notes

- The two-firm fixture is built once per run and torn down after; it uses a **separate
  database** (`DATABASE_URL` with a `_isolation_test` suffix, created on demand) so it
  can never touch a dev or production database.
- Tests assert on behaviour (what a firm can see) rather than on generated SQL.
- Both firms get identical-looking data — same names, same tags, same invoice numbers —
  so a test can only pass by respecting the tenant boundary, not by accident of
  distinct values.

## Risks

- **A skipped suite reads as a passing one.** Mitigated by the loud skip and the CI
  assertion above.
- **Fixture drift** as models are added. Mitigated by driving the per-model matrix from
  the schema-derived model list, so a new model joins the matrix automatically and fails
  until it's handled.
- **Slower `npm test`** once a database is involved. Kept to one fixture build per run.

## Decisions _(2026-07-27)_

- **Where it runs:** a third Vitest project included in `npm test`, skipping loudly
  without a database — plus a GitHub Actions workflow with a Postgres service that
  enforces it and asserts the suite actually ran.
- **CI scope:** the full check — tests + isolation + lint + tsc + build.
- **"Any route":** the chokepoint argument (structural check that every route uses the
  tenant client, plus an exhaustive per-model behavioural matrix through it) rather than
  64 hand-written route tests.

---

## What shipped

**448 tests** (was 369), coverage gate 97.06%, lint / tsc / build clean.

### The gate was verified by breaking isolation on purpose

A gate nobody has seen fail is decoration. Three deliberate breaches, each reverted after:

| Breach | Result |
|---|---|
| Removed the firm filter from reads | **39 of 45 isolation tests fail** |
| Removed firm stamping from creates | both create tests fail |
| Quietly added `Document` to the exempt list | the behavioural test *and* the structural guard fail |

Restoring each one returned the suite to green.

### Layer 1 — pure rules (`src/lib/isolation.ts`, 18 tests)
`checkQueryScope` decides whether a query is properly scoped, per operation kind.
Notably it fails closed twice over: a query naming *someone else's* firm is rejected,
and an operation the module doesn't recognize is refused rather than waved through.

### Layer 2 — integration matrix (45 tests, real Postgres)
Two firms with **deliberately identical data** — same client name, same `LT-1`, same
invoice `2506-001`, same "Lighting" offering. A test can only pass by respecting the
tenant boundary, never because the values happened to differ. Creating the fixture at
all exercises the per-firm uniques.

Driven from `schema.prisma`, so **all 29 tenant models** are covered and a new model
joins the matrix automatically — and fails until it's handled. Per model: disjoint
views, correct `firmId`, and `A + B = all rows`, which catches "isolation working" for
the wrong reason (a firm silently seeing nothing).

Plus cross-firm reads/writes, `updateMany`/`deleteMany` sweeps, relation-filter escape
attempts, nested writes (the extension's blind spot), per-firm uniques, fails-closed,
and `resolvePermissions` resolving differently for two firms.

### Layer 3 — structural guards (7 tests)
Every route uses the tenant client; no route imports raw `prisma`; no raw SQL in
application code; no page component queries directly; every model is scoped or
deliberately exempt; the pure and server exemption lists agree.

Together with Layer 2 this is the argument: every route goes through the client, and the
client isolates every model ⇒ no route can reach another firm's rows.

The raw-SQL guard caught something real on its first run — the isolation harness itself,
which issues `CREATE`/`DROP DATABASE`. Exempted with a comment, since that's DDL against
a scratch database rather than tenant data access.

### Safety of the harness
The suite derives its own database (`<name>_isolation_test`) from `DATABASE_URL` and
drops/recreates it each run. Nine unit tests pin that behaviour, including that it can
**never** resolve to the developer's own database. Verified in practice: after a full
run, the dev database still held its 1 firm / 69 vendors / 13 items, and the fixture
lived in the separate database.

### CI
There was none. `.github/workflows/ci.yml` now runs lint, tsc, the full test suite, the
isolation gate, the coverage thresholds, and the build — against a Postgres service
container.

`npm test` stays green in a fresh clone because the suite skips without a database. In
CI that would be a silent hole, so the workflow runs the gate separately and **fails if
it skipped or reported no passing tests** — a skipped security gate reads exactly like a
passing one otherwise.

## Note on scope

DES-26–30 were blocked on this. The gate is now green and enforced, so they're unblocked.

The one part of the issue's scope not covered is impersonation ("bounded and logged"),
because it doesn't exist yet — it's DES-30. When it lands, its tests belong in this
suite.


---

## Follow-up: the CI gate mis-read its own result

The first CI run failed with *"The tenant-isolation suite reported no passing
tests"* — on a run where all 45 passed and the summary said so.

The step scraped vitest's printed summary with
`grep -Eq "Tests +[0-9]+ passed"`. That matches locally, so I could not
reproduce it; the CI output evidently differs in whitespace or escape codes.
Chasing the exact difference would have been the wrong fix, because the real
problem is that a security gate was parsing human-readable output at all.

Now it reads the **JSON reporter** (`--reporter=json --outputFile=`) and asserts
on counts. The decision lives in `scripts/isolationReport.mjs` as a pure
function, so it is unit-tested like any other rule — matching the
`pg.mjs`/`pg.test.ts` precedent. Seven tests cover: green run, broken
isolation, suite-never-ran, partial skip, unreadable report, breakage
out-ranking skips, and a report missing counters.

Verified end-to-end through the exact CI command, plus all four failure modes
by hand.

**A gate that mis-reads its own result is worse than no gate** — it teaches you
to distrust a red build. That is why the fix is a tested function rather than a
better regex.
