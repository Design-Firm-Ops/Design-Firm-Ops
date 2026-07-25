# DES-24 — SUPER_ADMIN role + seeded super-admin + tenant-scoped session + /admin gate

**Linear:** [DES-24](https://linear.app/design-firm-ops/issue/DES-24) · milestone _Phase 3 — Multi-tenancy_ · **Urgent**
**Status:** ✅ implemented. See "What shipped" at the bottom.
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §3.3–3.4 · depends on DES-23 (merged)

## Scope

Five pieces, all from the issue:

1. `enum UserRole { ADMIN DESIGNER SUPER_ADMIN }` + migration.
2. Seed exactly one SUPER_ADMIN from `SEED_SUPER_ADMIN_*`, idempotently.
3. Thread `firmId` through the NextAuth JWT/session callbacks + `next-auth.d.ts`.
4. `getTenantContext(session)` → `{ firmId, role }`.
5. Middleware: match `/admin/:path*`, reject non-SUPER_ADMIN.

## Two things worth deciding

### 1. The `/admin` gate should be bidirectional

The issue's scope bullet says "reject non-SUPER_ADMIN from `/admin`". §3.4 asks for more:

> reject non-`SUPER_ADMIN` sessions from `/admin` (**and, conversely, keep `SUPER_ADMIN`
> out of firm `/app` data unless impersonating**)

That second half matters more than it looks. A SUPER_ADMIN has `firmId = null`. If they
load `/app`, `currentFirmId()` — the DES-23 bridge — resolves *the single existing firm*
and hands them that firm's projects, invoices, and vendor credentials. So without the
reverse gate, the super-admin silently becomes a member of whichever firm sorts first.

**Recommendation:** implement both directions. Non-SUPER_ADMIN → `/admin` is denied;
SUPER_ADMIN → `/app` is denied. Impersonation (DES-#8) is what will later grant the
second case deliberately, and it should have to.

### 2. A database-level guarantee of "exactly one"

§3.3 says "there is exactly one `SUPER_ADMIN`". Today that's a convention enforced by
the seed using `upsert`. It can be a real constraint:

```sql
CREATE UNIQUE INDEX "User_single_super_admin" ON "User" ((role)) WHERE role = 'SUPER_ADMIN';
```

I verified this on a scratch database before proposing it:

- `prisma migrate diff` against `schema.prisma` → **"This is an empty migration"**. Prisma
  can't declare partial indexes, but it also doesn't *notice* them, so there's no drift.
- Inserting a second SUPER_ADMIN fails: `duplicate key value violates unique constraint
  "User_single_super_admin"`.

**Recommendation:** add it. The whole point of the role is that it's rare and
un-mintable; a constraint that can't be forgotten beats a convention that can. Cost is
one raw-SQL statement carrying a comment explaining why it isn't in `schema.prisma`.

## Approach

### Schema + migration
Add `SUPER_ADMIN` to the enum. Hand-written migration (Postgres needs `ALTER TYPE ...
ADD VALUE`, and it can't run inside a transaction with other statements in older PG),
plus the partial index above. Idempotent, same discipline as DES-23.

### Seeding
Extract the super-admin upsert into its own module so it can be unit-tested — `seed.ts`
runs `main()` on import and can't be imported safely, the same reason `scripts/pg.mjs`
exists. `prisma/seed.ts` calls it.

- Upsert by email; `role: SUPER_ADMIN`, `firmId: null`; bcrypt-hashed.
- Re-running rotates the password from env and never duplicates.
- **Skips cleanly when `SEED_SUPER_ADMIN_EMAIL` is unset**, so existing dev setups and
  `npm run setup` don't break — and logs that it skipped, rather than failing silently.

### Session
`jwt`/`session` callbacks carry `firmId`; `next-auth.d.ts` gains `firmId: string | null`
and `SUPER_ADMIN` in the role union. `authorize()` already returns the user row, so it
just needs to include `firmId`.

### `getTenantContext`
Lives in `src/lib/tenant.ts` (pure — session in, context out, no database), so it stays
on the pure side of the DES-33 boundary and is testable without mocks.

Shape: `{ firmId: string | null; role: UserRole; isSuperAdmin: boolean }`, plus a
`requireFirmId(session)` that throws for a session with no tenant — DES-#3 will want
exactly that when it converts `currentFirmId()` call sites.

### Middleware
`withAuth`'s `authorized` callback for the path/role rules, keeping the matcher and
`signIn` page behaviour intact.

## Tests

Per the acceptance criteria, plus a little more where it's cheap:

- **`getTenantContext`** — firm user, super-admin, signed-out, unknown role.
- **Seed idempotency** — repeat runs upsert rather than insert; password rotates;
  `firmId` stays null; skips when env is unset.
- **Middleware gate** — all four combinations of {firm user, super-admin} × {`/app`,
  `/admin`}, plus unauthenticated.
- The existing `auth.test.ts` gains cases for `firmId` reaching the token and session.

## Verification

- Acceptance: fresh `prisma:seed` creates exactly one SUPER_ADMIN; re-running doesn't
  duplicate; firm users' `/app` unchanged.
- Rehearse the migration on a throwaway Postgres as in DES-23: apply, re-run for
  idempotence, `migrate diff` for drift, and prove the partial index rejects a second
  super-admin.
- `npm test`, coverage gate, lint, tsc, build.

## Out of scope

Converting `currentFirmId()` call sites to session-derived tenancy is DES-#3. This issue
makes the session *carry* the tenant and provides the helper; it doesn't rewire the 14
call sites. Actual isolation enforcement and its test suite remain #3 and #9, which §7
still gates the dashboard on.

## Decisions _(2026-07-25)_

- **Bidirectional gate** — non-SUPER_ADMIN denied `/admin`; SUPER_ADMIN denied `/app`.
- **DB-level constraint** — partial unique index enforcing at most one SUPER_ADMIN.

---

## What shipped

All five scope items plus both approved additions. **364 tests** (was 335), coverage
gate 97.68%, lint / tsc / build clean.

### The rehearsal caught a real bug

The migration was written as one file: `ALTER TYPE ... ADD VALUE 'SUPER_ADMIN'` followed
by the partial index that references it. Running it through `psql` worked, so it looked
fine. `prisma migrate deploy` rejected it:

```
ERROR: unsafe use of new value "SUPER_ADMIN" of enum type "UserRole"
HINT:  New enum values must be committed before they can be used.
```

Postgres won't let a new enum value be *used* in the transaction that added it, and
Prisma wraps each migration file in a transaction. `psql` autocommits per statement,
which is precisely why the scratch test I ran while planning didn't surface it.

Split into two migrations — `20260725020000_super_admin_role` (the enum) and
`20260725020100_single_super_admin_index` (the index) — so the value commits first. Both
carry a comment explaining why they're separate, because "merge these, they're tiny"
is the obvious future mistake.

### Acceptance criteria, verified against a real database

| Criterion | Result |
|---|---|
| Fresh seed creates exactly one SUPER_ADMIN | `SUPER_ADMIN count: 1`, `firmId` null |
| Re-running does not duplicate | 3 seed runs → still exactly 1, logged `updated` |
| Password rotates from env | matches new password `true`, old `false` |
| Firm users unchanged | `ADMIN: 2, DESIGNER: 1 — all with firmId`; `SUPER_ADMIN: 1 — without` |
| No drift | `prisma migrate diff` → "This is an empty migration" |
| Constraint bites | second insert → `duplicate key value violates unique constraint "User_single_super_admin"` |
| Existing setups don't break | env unset → `super-admin: skipped (SEED_SUPER_ADMIN_EMAIL is not set)`, seed completes |

### Files

- `prisma/schema.prisma` — `SUPER_ADMIN` on `UserRole`, commented.
- Two migrations, as above.
- `src/server/superAdmin.ts` — extracted so idempotency is unit-testable; `seed.ts` calls
  it. Re-asserts `role` and `firmId` on update, not just the password, so an account
  edited into a firm is put back by the next deploy.
- `src/lib/tenant.ts` — `getTenantContext`, `requireFirmId`, `isSuperAdmin`. Pure, so it
  stays on the correct side of the DES-33 boundary.
- `src/server/auth.ts`, `src/types/next-auth.d.ts` — `firmId` on the token and session.
- `src/middleware.ts` — bidirectional gate; `isAuthorizedFor` exported so the *policy*
  is tested rather than Next's redirect plumbing.
- `src/test/mocks.ts` — `fakeSession` defaults to a firm user with a `firmId`.
- `.env.example` — `SEED_SUPER_ADMIN_*`.

### Still out of scope

The 14 `currentFirmId()` call sites are untouched. The session now *carries* the tenant
and `requireFirmId` is ready for them, but rewiring is DES-#3 and enforcement testing is
DES-#9. **There is still no tenant isolation** — §7 continues to gate the dashboard on
both.
