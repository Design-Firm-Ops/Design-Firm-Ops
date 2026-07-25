# DES-23 — Tenancy data model: Firm entity, firmId on all roots, per-firm uniques + backfill

**Linear:** [DES-23](https://linear.app/design-firm-ops/issue/DES-23) · milestone _Phase 3 — Multi-tenancy & super-admin dashboard_ · **Urgent**
**Status:** ✅ implemented. See "What shipped" at the bottom.
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §3.1–3.2, §6

## Why this needs care

This is the foundation the whole phase sits on, and the issue flags it
**destructive-adjacent** — the migration rewrites every table. It's also the one change
where a mistake doesn't fail loudly: a missing `firmId` doesn't crash, it leaks one
firm's financials to another. So this plan front-loads the schema decisions and the
verification strategy rather than the code.

I read the current schema against §3.2 before planning. **Two things in the referenced
plan don't survive contact with the code.**

---

## Finding 1 — Two tenant-owned taxonomies are missing from §3.2's list

§3.2 lists the direct-`firmId` entities as: `User`, `Client`, `Project`, `Vendor`,
`Offering`, `ProjectType`, `ResourceFolder`, `Resource`, `LeadBoard`, `ReferralPartner`,
`Settings`.

It omits **`ItemTypeOption`** and **`FeeStructureOption`**. Both are user-grown, firm-specific
vocabulary — they're created on the fly as people type new values
(`findOrCreateItemType`, `findOrCreateFeeStructureOption`), exactly like `Offering` and
`ProjectType`, which *are* on the list. Left global they cause three concrete problems:

1. **Vocabulary leak.** Firm A's item types and fee structures appear in Firm B's
   dropdowns.
2. **Silent cross-tenant reuse.** `@@unique([category, name])` means Firm B creating
   "Lighting / Sconce" doesn't create a row — it finds Firm A's and returns that id, so
   Firm B's items point at Firm A's taxonomy row.
3. **Tag prefixes collide across firms.** `generateUniquePrefix` reads *every* existing
   prefix (`findMany({ select: { tagPrefix: true } })`), so Firm A's prefixes constrain
   Firm B's, and firm B's second lighting type could end up "SC2" for no reason visible
   to them.

**Recommendation:** add `firmId` to both, and convert `@@unique([category, name])` →
`@@unique([firmId, category, name])` and `@@unique([scope, name])` →
`@@unique([firmId, scope, name])`. `generateUniquePrefix` must also scope its
"taken prefixes" query by firm (a `src/server` change, small).

## Finding 2 — §6's Q1 recommendation contradicts its own Q5 recommendation

Q1 recommends **per-firm** user accounts (`@@unique([firmId, email])`). Q5 recommends
deriving the tenant from the session's `firmId`, with **no subdomain routing** in v1.
Those two can't both hold:

- Credentials login is `prisma.user.findUnique({ where: { email } })`
  ([src/server/auth.ts:21](../src/server/auth.ts)). With email unique only *per firm*,
  an email no longer identifies one user — and `findUnique({ where: { email } })` stops
  being valid Prisma at all. Login would need a firm picker or a subdomain to
  disambiguate, which Q5 explicitly defers.
- **`SUPER_ADMIN` makes it worse.** §3.3 gives them `firmId = null`. In Postgres, NULLs
  are distinct inside a unique index, so `@@unique([firmId, email])` would happily allow
  *many* super-admins sharing one email — the opposite of "there is exactly one
  SUPER_ADMIN".

**Recommendation:** keep `User.email` **globally unique** for v1. It's the only option
consistent with session-derived tenancy, it keeps the super-admin uniqueness guarantee,
and it costs nothing to revisit later (going global → per-firm is a widening change;
the reverse is not).

---

## Proposed schema

### `Firm` (new)

Per §3.1: `id`, `name`, `slug @unique`, `status FirmStatus @default(TRIAL)`,
`plan String?`, timestamps, plus back-relations. `enum FirmStatus { TRIAL ACTIVE
SUSPENDED CANCELED }`.

`slug` is kept even though v1 doesn't do subdomain routing — it's the stable handle the
`/admin` console will use in URLs, and adding a unique column later to a populated table
is more painful than carrying it now.

### Direct `firmId` (tenant roots)

The §3.2 list **plus** `ItemTypeOption` and `FeeStructureOption` (Finding 1) — 13 models.
Each gets `firmId String`, `firm Firm @relation(...)`, and `@@index([firmId])`.

`User.firmId` is **nullable** — that's how `SUPER_ADMIN` is represented (§3.3).
Every other root is non-null.

### Per-firm uniques

| Model | Now | After |
|---|---|---|
| `Offering.name` | `@unique` | `@@unique([firmId, name])` |
| `ProjectType.name` | `@unique` | `@@unique([firmId, name])` |
| `ResourceFolder.name` | `@unique` | `@@unique([firmId, name])` |
| `ItemTypeOption` | `@@unique([category, name])` | `@@unique([firmId, category, name])` |
| `FeeStructureOption` | `@@unique([scope, name])` | `@@unique([firmId, scope, name])` |
| `Invoice.invoiceNumber` | `@unique` | `@@unique([firmId, invoiceNumber])` |
| `User.email` | `@unique` | **unchanged** (Finding 2) |
| `Settings` | `id Int @default(1)` singleton | `id String @default(cuid())`, `firmId String @unique` |

Staying globally unique: `Invoice.portalToken` (a random secret, not a per-firm name),
and `Lead.convertedProjectId` (a FK to a globally-unique project).

### Denormalized `firmId` on children — the Q2 decision

`Invoice.invoiceNumber` needs `firmId` on `Invoice` regardless, so that one is forced.
Beyond it, see the question below.

---

## Migration strategy

One migration, written by hand rather than left to `prisma migrate dev`'s autogeneration,
because the ordering matters:

1. `CREATE TABLE "Firm"` + the enum.
2. Insert the single firm — **"Madison Ditton Interiors"**, slug `madison-ditton-interiors`,
   status `ACTIVE` — with a **fixed, literal id** so the step is idempotent and re-runnable.
3. Add `firmId` to each root as **nullable**.
4. `UPDATE` every root, setting `firmId` to that literal id.
5. `ALTER ... SET NOT NULL` (except `User.firmId`, which stays nullable).
6. Drop the old unique constraints, add the composite ones. Order matters: the old
   `Settings` PK/singleton has to go before the new shape lands.
7. Add FKs and indexes.

Steps 3–5 are the standard nullable → backfill → not-null dance; doing it in one shot
fails on any table with existing rows.

`prisma/seed.ts` creates the firm explicitly and attaches everything to it.

## Verification

The acceptance criteria are the floor, not the ceiling:

- `npm run prisma:migrate` + `prisma:generate` clean; **existing data still loads**.
- **The reference invoice still reconciles to $22,933.48 for Firm 1** — `pricing.test.ts`
  already pins this and must stay green.
- `npm test` (326 tests), `npm run lint`, `npm run test:coverage` gate, `npm run build`.

Plus, because this is destructive-adjacent:

- **Rehearse on a copy.** `pg_dump` the dev database, restore to a scratch database, run
  the migration against *that*, and diff row counts per table before/after. No table may
  lose rows; every row must end with the firm id.
- **Re-run the migration** against the already-migrated scratch DB to prove idempotence.
- Any test touching `Settings` moves off `id: 1` — `resolvePermissions` currently reads
  `where: { id: 1 }` and will need `where: { firmId }`. That's §3.3/DES-#3 work, but the
  *schema* change lands here, so I'll keep the loader compiling by threading firmId
  through minimally and leave real enforcement to the isolation issue.

## Scope boundary

This issue is **schema + migration + seed only**. Explicitly *not* here:

- Session carrying `firmId`, `SUPER_ADMIN` role, `getTenantContext` (→ DES-#2).
- Query scoping / the Prisma client extension (→ DES-#3).
- Isolation test suite (→ DES-#9).
- `/admin` console (→ DES-#4+, and §7 says not before #1–#3 are merged and #9 is green).

I'll note where the schema forces a temporary compile-level accommodation, but I won't
build enforcement here — that's what makes the isolation tests meaningful when they land.

## Risks

- **Silent tenancy holes.** Mitigated by Finding 1, and by the isolation suite later.
- **A single-firm backfill bakes in "everything belongs to Firm 1".** That's the intended
  assumption, stated explicitly in the migration.
- **`Settings` de-singletoning touches every read.** There are 8 `settings.findUnique`
  call sites; all become firm-scoped.
- **Migration ordering.** Rehearsing on a restored copy is the mitigation.

## Open questions — §6, resolved for this issue

| § | Question | Recommendation |
|---|---|---|
| Q1 | `User.email` global vs per-firm | **Global** — Finding 2 |
| Q2 | Denormalize `firmId` onto child tables | See question below |
| Q3 | Scoping mechanism | Client extension — but that's DES-#3; it only affects Q2 here |
| Q4 | Billing scope | `plan String?` + `status` now, defer real billing — taking the recommendation |
| Q5 | Firm routing | `firmId` from session; keep `slug` for `/admin` URLs — taking the recommendation |
| Q6 | Where `SUPER_ADMIN` lives | Already decided in the doc |

### Resolved _(2026-07-24)_

- **Q1 — `User.email` stays globally unique.** Per Finding 2.
- **Finding 1 — `ItemTypeOption` and `FeeStructureOption` get `firmId`**, with
  `@@unique([firmId, category, name])` and `@@unique([firmId, scope, name])`.
  `generateUniquePrefix` scopes its taken-prefix query by firm.
- **Q2 — denormalize `firmId` onto `Invoice`, `Item`, `Payment`** (the high-traffic,
  money-carrying tables). Everything else scopes through its parent.
- **Q4 / Q5** — taken as recommended: `plan String?` + `status`; tenancy from the
  session, `slug` retained for `/admin` URLs.

---

## What shipped

Schema, backfill migration, seed, and the code changes needed to compile and run
against them. **335 tests** (was 326), coverage gate at 97.59%, lint / tsc / build clean.

### Both acceptance criteria met

- `prisma migrate deploy` + `prisma:generate` clean, and existing data still loads
  under Firm 1.
- **The reference invoice reconciles to $22,933.48 for Firm 1 after migration** —
  verified against a migrated-and-seeded database, not just the unit test:

  ```
  firm:      Madison Ditton Interiors (firm_mdi_0000000000000000)
  items:     13   every item carries the firm id: true
  subtotal:  $19287.85   shipping: $2295.48   tax: $1350.15
  GRAND:     $22933.48   RECONCILES ✓
  ```

### Rehearsal on a database copy

Because this is destructive-adjacent, it was rehearsed on a throwaway Postgres 16
container rather than trusted:

1. Applied every *prior* migration to build a genuine pre-tenancy database, then
   seeded it with the real 65-vendor dataset and the demo project.
2. Ran the tenancy migration. **Row counts before vs. after: identical** — no table
   lost or duplicated a row.
3. Confirmed every one of the 16 firmId-bearing tables was fully adopted, with zero
   rows outside the firm.
4. **Re-ran the migration twice more.** Both no-ops (only benign "already exists"
   notices); row counts unchanged after three runs.
5. `prisma migrate diff` between the migrated database and `schema.prisma`:
   **"This is an empty migration"** — the hand-written SQL produces exactly the schema
   Prisma expects, with no drift.
6. Separately verified the **fresh-install** path: `migrate deploy` onto an empty
   database, zero drift, seed succeeds.

### Schema

16 models carry `firmId`: the 13 tenant roots (`User` nullable, for `SUPER_ADMIN`)
plus the three denormalized money tables. Uniques converted as planned; `User.email`,
`Invoice.portalToken`, and `Lead.convertedProjectId` deliberately stay global.
`Settings` de-singletoned from `id Int @default(1)` to a cuid keyed by `firmId @unique`.

### The temporary bridge — `src/server/firm.ts`

Tenancy is not on the session yet (that's DES-#2), so `currentFirmId()` resolves the
single firm the backfill created. It is deliberately loud: with no firm row it throws
rather than inventing a tenant.

**Every call site is a to-do for DES-#3.** `grep -rn currentFirmId src/` is the list —
14 of them. The isolation suite (DES-#9) should fail while any remain.

`projectFirmId(projectId)` is the exception and stays: `Invoice`, `Item`, and `Payment`
take their denormalized `firmId` from the parent project rather than from the ambient
firm, so the "must match project.firmId" invariant holds by construction rather than by
convention. Tested.

### Deliberately out of scope

No session `firmId`, no `SUPER_ADMIN` role, no query scoping, no `/admin`. §7 sequences
those after this lands, and building enforcement here would have made the isolation
tests meaningless when they arrive.

**This means there is no tenant isolation yet.** The data model can express it; nothing
enforces it. That is the expected state after #1 and the reason #3 and #9 gate the
dashboard work.
