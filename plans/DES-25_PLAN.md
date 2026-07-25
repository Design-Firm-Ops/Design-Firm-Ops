# DES-25 — Central tenant isolation + firm-scoped resolvePermissions

**Linear:** [DES-25](https://linear.app/design-firm-ops/issue/DES-25) · milestone _Phase 3_ · **Urgent** · security-critical
**Status:** ✅ implemented. See "What shipped" at the bottom.
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §3.3, §5 · depends on DES-23, DES-24 (both merged)

This is the issue where a mistake doesn't fail loudly — it leaks one firm's financials to
another. So the plan front-loads what I found in the current code over how the extension
is written.

## What isolation looks like today: there isn't any

DES-23 gave 16 models a `firmId`. **13 have none**, and several of those are queried
directly by id with no tenant filter at all. These are live cross-tenant paths on `main`
right now:

| Route | Query | Effect |
|---|---|---|
| `DELETE /api/documents/[id]` | `document.findUnique({ where: { id } })` | Delete any firm's document |
| `PATCH /api/leads/[id]` | `lead.update({ where: { id } })` | Edit any firm's lead |
| `DELETE /api/pipeline-stages/[id]` | `pipelineStage.delete({ where: { id } })` | Delete any firm's stage |
| `PATCH/DELETE /api/procurement-lists/[id]` | `procurementList.update/delete` | Any firm's list |
| `PATCH/DELETE /api/document-folders/[id]` | `projectDocumentFolder.*` | Any firm's folder |
| `GET /api/item-field-defs` | `itemFieldDef.findMany({ orderBy })` | **Every** firm's field defs |
| `GET /api/project-field-defs` | `projectFieldDef.findMany({ orderBy })` | Same |
| `queries/settings.listPermissionOverrides` | `userPermissionOverride.findMany()` | Every firm's overrides |

That's expected — DES-23 built the model, DES-24 built the session, and enforcement is
*this* issue. Stating it plainly because it's the thing being fixed.

## Finding — `ProjectFieldDef` and `ItemFieldDef` are unscoped tenant roots

Both are **top-level rows with no parent at all**: no `projectId`, no `itemId`, no
`firmId`. They're firm-wide custom field definitions that users create and order.

Which means **today every firm shares one set of custom field definitions.** Firm B sees
Firm A's field labels on its projects and items, can reorder them, and can delete them.

This is the same class of bug as `ItemTypeOption` / `FeeStructureOption` in DES-23 —
user-grown per-firm vocabulary that §3.2's list didn't mention. These two were missed
then because they have no parent to inherit through, so nothing about them looked like a
child table.

They need `firmId` regardless of which scoping strategy we pick below. That's a schema
change and a backfill migration, so it belongs in this issue's scope rather than being
worked around in the extension.

## The decision: how to scope the other 11 models

An auto-injecting extension can only inject `firmId` where the column exists. For the
models without one there are two workable approaches.

### Option A — Denormalize `firmId` onto every tenant model *(recommended)*

Add `firmId` to all 13. The extension then has **one rule for every model**: inject
`where: { firmId }` on reads, set it on creates, guard it on writes.

- No per-model configuration to get wrong, and "fails closed" becomes trivially
  checkable — a tenant model either has the column or it isn't a tenant model.
- Works with `findUnique` (see the note below), `count`, `aggregate`, `groupBy`
  uniformly.
- The extension *sets* `firmId` on create, so the "must match the parent" invariant is
  maintained automatically rather than by hand at each call site.
- Cost: 13 columns + a backfill migration (the DES-23 pattern, already rehearsed), and
  `Document` gains a column it can derive from three different parents.

### Option B — Per-model relation-path filters

Teach the extension how to reach `firmId` for each model:
`ProcurementList → project`, `PipelineStage → board`, `Lead → pipelineStage → board`, …

- No schema change for 11 of the 13.
- But: every read grows a join; `findUnique` can't take relation filters so those all
  become `findFirst`; two-hop paths (`Lead`) are fragile; and **`Document` has three
  nullable parents** (`project`, `lead`, `item`), so it needs an OR across three paths
  and a rule for what an orphan document means.
- The per-model map becomes the thing that must never be wrong — which is the same
  failure mode we're trying to design out.

**Recommendation: Option A.** The extension's reliability *is* the security property
here; one uniform rule is worth 13 columns. Option B concentrates the risk in a config
map that's easy to forget to update when a model is added — exactly how these two field
def tables got missed in the first place.

## Proposed design

### `src/server/tenantDb.ts`
`getTenantDb(session)` returns `prisma.$extends(tenantScope(firmId))` — the firm is
captured in the closure, so there's no ambient request state to get wrong and no
`AsyncLocalStorage` in play. Memoized per firm id.

The extension intercepts `$allModels.$allOperations`:

- **Reads** (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`) — merge
  `where: { firmId }`.
- **`findUnique`** — rewritten to `findFirst` with the firm filter added. Prisma rejects
  non-unique fields in a `findUnique` where-clause, so this rewrite is required; it's the
  standard approach and the behavioural difference is nil for our call sites.
- **Creates** — set `firmId` from the context, overriding whatever was passed.
- **Updates / deletes / upserts** — merge the firm filter so a wrong-tenant id affects
  zero rows instead of someone else's.
- **Non-tenant models** pass through untouched.
- **No firm in context** (a `SUPER_ADMIN`, or an unauthenticated caller) — **throws**.
  That's the "fails closed" criterion, and it's why super-admins reaching firm data has
  to be deliberate (impersonation, DES-#8).

### Routes
Replace `prisma` with `await getTenantDb(session)` across the API routes and the
`src/server/queries` modules.

### `resolvePermissions`
Takes the firm from the session (`requireFirmId`) instead of `currentFirmId()`, loading
that firm's `Settings`. The pure policy in `src/lib/permissions.ts` is unchanged.

### Retire the DES-23 bridge
`currentFirmId()` was explicitly temporary — "every call site is a to-do for DES-#3".
All 14 go; the module is deleted. `projectFirmId()` also goes, since the extension now
sets `firmId` on create.

### Tighten the lint boundary
DES-33's rule allows raw `@/server/prisma` in `src/app/api/**`. That exemption is exactly
the hole this issue closes, so it goes: routes may only use `getTenantDb`. Forgetting
becomes a lint error rather than a silent cross-tenant query. (This is the follow-up I
flagged in the DES-33 PR.)

## Tests

The full isolation suite is DES-#9, but this issue ships the tests that prove its own
acceptance criteria:

- **Fails closed** — a tenant-model query with no firm in context throws; a super-admin
  session throws.
- **Read scoping** — `findMany`/`findFirst`/`count` get the filter; a `findUnique` for
  another firm's row returns null rather than the row.
- **Write scoping** — create sets `firmId`; update/delete of another firm's id affects
  nothing.
- **Passthrough** — non-tenant models are untouched.
- **`resolvePermissions`** — two firms with different Settings resolve differently.
- Migration rehearsed on a throwaway Postgres, as in DES-23/24: row counts preserved,
  idempotent, no drift.

## Risks

- **Broad, security-critical diff.** Mitigated by the extension being one small module
  with heavy tests, and by lint making the unsafe path uncompilable.
- **`findUnique` → `findFirst` rewrite** is a real semantic change; called out above.
- **A second backfill migration** so soon after DES-23. Same rehearsed pattern.
- **`Document`'s denormalized `firmId`** must be set from whichever parent exists; the
  extension does it on create, and the backfill derives it via `COALESCE` over the three
  parents.

## Decisions _(2026-07-25)_

- **Option A** — denormalize `firmId` onto all 13 remaining tenant models, so the
  extension has one uniform rule.
- **Drop the `src/app/api/**` lint exemption** — routes may only reach the database
  through `getTenantDb`.

---

## What shipped

**369 tests** (was 364), coverage gate 95.77%, lint / tsc / build clean.

### One thing turned out simpler than planned

The plan flagged a `findUnique` → `findFirst` rewrite as a required semantic change.
It isn't: Prisma 5 accepts a non-unique field alongside a unique one ("extended where
unique"), verified directly —

| Attempt | Result |
|---|---|
| `findUnique({ where: { id, firmId: <other firm> } })` | `null` |
| `update({ where: { id, firmId: <other firm> } })` | throws `P2025`, row unchanged |
| `delete({ where: { id, firmId: <other firm> } })` | throws `P2025`, row survives |

So the extension only merges `firmId` into `where` and stamps it onto `data`. No
operation is rewritten, every return type is unchanged, and call sites behave exactly
as before — for their own firm. The risk in the plan doesn't exist.

### Isolation, proved against a live two-firm database

Not mocks. Two firms each with their own client, project, items, leads, boards,
documents and field values:

```
Document: A sees 1, B sees 2, disjoint        Lead: A sees 1, B sees 1, disjoint
PipelineStage / ProcurementList / ProjectDocumentFolder / DesignFeeCharge /
ClientContact / ProjectRoom: all disjoint
A cannot delete B's document                  B's document survives
create stamps firmId automatically            create ignores a caller-supplied firmId
unauthenticated session refused               super-admin session refused
```

### Migration

Rehearsed as in DES-23/24, and the two-firm dataset is what made it meaningful — every
child had to derive the *right* firm, not merely a non-null one:

- `Document` resolved through all three of its nullable parents (project → A, lead → B,
  item → B) — the case that would have needed a three-way OR under relation-path scoping.
- `Lead` resolved through its two-hop path (pipelineStage → board).
- `ProjectFieldValue` / `ItemFieldValue` / `UserPermissionOverride` each followed their
  own parent across firms.
- Row counts preserved; idempotent across three runs; `migrate diff` → empty.

### Retired

`src/server/firm.ts` is gone — `currentFirmId()` was explicitly temporary in DES-23 and
all 14 call sites are now session-derived. The find-or-create helpers and query modules
take `firmId` explicitly.

### The lint gate now covers routes

The `src/app/api/**` exemption is dropped, so a route reaching for raw `prisma` fails
lint with a message pointing at `tenantContext`. Verified by probe in both directions.

## Two things worth knowing

1. **Nested writes bypass the extension.** `client.create({ data: { contacts: { create:
   [...] } } })` is a single query, so `$allOperations` never sees the inner rows. Those
   need `firmId` passed explicitly — and TypeScript demands it, which is how you find
   them. `tenantContext(session)` returns the firmId alongside the client for exactly
   this. Top-level writes are still stamped by the extension regardless of what's passed.

2. **`resolvePermissions` now fails closed.** A session with no firm previously resolved
   to designer defaults, which still grant procurement, documents and invoices. It now
   throws. Routes always call it behind `requireSession`, so no live caller is affected.

## Still to come

The dedicated isolation suite is DES-#9, and §7 gates the dashboard on it. What ships
here is enforcement plus the tests proving this issue's own acceptance criteria; #9 is
where the adversarial matrix belongs.
