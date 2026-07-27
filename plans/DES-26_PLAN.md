# DES-26 — `/admin` console shell + firms list

**Linear:** [DES-26](https://linear.app/design-firm-ops/issue/DES-26/admin-console-shell-firms-list) · milestone _Phase 3_ · **High**
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §3.4, §4.4 · builds on DES-24 (role/gate) and DES-25 (isolation)
**Gate:** DES-31 merged, isolation suite green and enforced in CI (PR #12). Unblocked.

The console's entry point: a SUPER_ADMIN-only area at `/admin`, separate from firm-facing
`/app`, whose first screen is a searchable list of every firm.

## The one interesting problem

Everything else in this app is tenant-scoped by construction. This screen is the first
that is *deliberately not* — a super-admin must see across firms. The acceptance criterion
is precise about how:

> Reads are not tenant-scoped … but go through an **explicit cross-firm path, not by
> bypassing isolation ad hoc**.

That distinction is the whole design. "Ad hoc" would be `/admin` pages importing
`@/server/prisma` directly — which happens to be exactly what DES-25's lint rule and
DES-31's structural guards forbid, and for good reason: once one file may reach unscoped
prisma "because it's admin", the argument that *no* route can cross firms stops being
checkable by a machine.

So the cross-firm door gets built as a door: one named module, guarded, and asserted to be
the only one.

### `src/server/platformDb.ts`

Deliberately mirrors `tenantDb.ts`, including the shape of its failure:

```ts
export function getPlatformDb(session): PrismaClient   // throws unless SUPER_ADMIN
```

- **Fails closed the same way `getTenantDb` does.** `getTenantDb` throws for a super-admin;
  `getPlatformDb` throws for everyone else. The two are exact complements, so there is no
  session that can reach both, and no session that can reach neither by accident.
- Returns the **unextended** client — that is the point of the module, and why the check
  lives at the door rather than in each query.
- Lives in `src/server/`, so the existing ESLint override already lets it import prisma.

### Keeping it the *only* door

Three layers, because a convention nobody checks is not a boundary:

1. **ESLint** — a new `no-restricted-imports` pattern for `@/server/platformDb`, with an
   override allowing `src/app/admin/**` and `src/server/**`. Same mechanism DES-33 used;
   probe-tested in both directions (a violation must actually error) after the DES-33
   lesson where an invalid config silently disabled the rule.
2. **A structural guard** in `isolationGuards.test.ts` — nothing outside `src/app/admin/`
   and `src/server/` imports the platform client. Belt and braces with the lint rule so it
   fails `npm test` too, matching how the existing raw-prisma guard is doubled up.
3. **A behavioural test** in the isolation suite — with two firms seeded, the platform
   client sees both, and it refuses a non-super-admin session. This is the piece that
   proves the door opens for the right caller and no one else, against a real database.

The existing guard *"every API route uses the tenant-scoped client"* stays untouched:
DES-26 adds no API routes. Filtering is `searchParams` + a server component, the pattern
`StatusFilter` already uses, so the console's read path is server-only.

## What gets built

### Route group — `src/app/admin/`

Note the name collision to avoid: `src/app/app/administration/` already exists and is the
firm-facing *documents* screen. The console is `src/app/admin/` — a different area for a
different audience. Worth a comment in both layouts.

- `layout.tsx` — server check (`redirect('/login')` unless SUPER_ADMIN) as defense in
  depth behind middleware, exactly as `app/layout.tsx` does for `/app`. Middleware already
  gates `/admin` bidirectionally from DES-24; this is the second lock, per the acceptance
  criterion's "middleware **+** server checks".
- `page.tsx` — redirects to `/admin/firms`, so `/admin` is a real entry point.
- `firms/page.tsx` — the list.
- `firms/FirmFilters.tsx` — client component, search box + status select.

### The list

Columns from the issue: **status, plan, user count, project count, created, last activity**.

Counts come from Prisma's `_count` in the same query as the firms themselves. Search and
status filter run in SQL (`contains` + `mode: 'insensitive'`), not in JS after the fact —
this list grows with the customer base, and filtering in memory is the kind of thing that
is fine until it isn't.

**Last activity has no column today**, which is the one genuine data question in this
issue. Options in the question below; recommendation is to derive it from
`max(updatedAt)` across projects, invoices and items via three `groupBy` queries merged in
a pure function. All three carry an indexed `firmId`, so it's three index scans and no
migration, and "activity" means what an operator would expect — someone did work in the
system — rather than "somebody edited the firm record".

### Shell / nav

A distinct `AdminNav`, not the firm `Nav` (whose links all point into `/app`). Same brand
palette, visibly different chrome so an operator is never in doubt which side they're on —
which also lays the groundwork for DES-30, where impersonation has to be *unmistakable*.

The genuinely duplicated part between the two headers is small: the active-link styling
(`pathname.startsWith(href)` → class toggle). See the DRY question below.

## Test strategy (TDD — tests first)

| Layer | File | What it pins |
|---|---|---|
| Pure | `src/lib/firmFilters.test.ts` | parsing search params (unknown status → `ALL`, trimming, empty search), the `where` builder, and `latestActivity()` merging nullable dates |
| Server | `src/server/platformDb.test.ts` | fails closed: throws for signed-out, ADMIN, DESIGNER; returns a client for SUPER_ADMIN |
| Server | `src/server/queries/firms.test.ts` | the query shape — filters reach SQL rather than JS (mocked prisma) |
| Component | `src/components/AdminNav.test.tsx` | renders links, marks the active one, signs out |
| Component | `src/app/admin/firms/FirmFilters.test.tsx` | typing/selecting pushes the right query string |
| Structural | `src/server/isolationGuards.test.ts` | the platform client is imported only from `/admin` and `src/server` |
| Integration | `src/server/tenant.isolation.test.ts` | with two firms seeded: platform client sees both; tenant clients still see one each |

The isolation-suite addition matters more than its size suggests. DES-26 is the first
feature that *intentionally* reads across firms, so the suite should now assert both
halves — that the tenant path still can't cross, and that the platform path can, only for
a super-admin. Without that second half, a future change could break cross-firm reads and
the gate would stay green.

## Risks

- **A cross-firm read path exists at all.** Mitigated by the three layers above; the
  module is small and does one thing, so it stays reviewable.
- **Guard drift** — the new lint rule and the guard test encode the same policy in two
  places. Same trade-off the repo already accepted for raw prisma, and the DES-31 pattern
  of asserting the two exemption lists agree applies here too.
- **`_count` + `groupBy` cost** grows with firm count. Fine at this scale; noted for
  DES-29 (platform metrics), which will want the same aggregates and should reuse them.

## Decisions _(2026-07-27)_

- **Last activity:** derived across work tables — `max(updatedAt)` on projects, invoices
  and items, merged by a pure `latestActivity()`. No migration, three indexed scans, and
  it can't silently drift the way a maintained column would.
- **Nav sharing:** extract `NavLinks` (the link list and active-state styling) and nothing
  else. Firm and console headers keep their own chrome, so the console can grow DES-30's
  impersonation banner without the firm nav sprouting flags.

## Out of scope (deliberately)

- **Firm detail page and lifecycle actions** (suspend/reactivate/cancel) — that's DES-27.
  Firm names in this list are therefore not links yet; making them link to a 404 would be
  worse than not linking.
- **Create firm** — DES-28. **Metrics/KPIs** — DES-29. **Audit log** — DES-30.
- No `/admin` API routes: the list is read-only and server-rendered.

---

## What shipped

**517 tests** (was 455), 49 of them in the isolation suite (was 45). Lint, tsc, coverage
gate and build all clean; `/admin` and `/admin/firms` appear in the build output.

### The cross-firm door

`src/server/platformDb.ts` — `getPlatformDb(session)`, the exact complement of
`getTenantDb`. The check itself is `requireSuperAdmin` in `src/lib/tenant.ts`, mirroring
`requireFirmId`, so the rule stays on the pure side and gets unit-tested without a
database.

The property worth stating: **no session can open both doors, and none opens either by
accident.** `platformDb.test.ts` asserts it by trying every role against both.

Guarded three ways, each verified by breaking it on purpose:

| Breach | Result |
|---|---|
| Removed the SUPER_ADMIN check from `getPlatformDb` | 5 unit tests **and** an isolation test fail |
| Firm-facing page imports `platformDb` | structural guard fails |
| `/admin` ESLint override quietly stops banning raw prisma | config guard fails |

The lint rule was probe-tested in all three directions, after DES-33's lesson that an
invalid config disables a rule silently: firm-facing → platform client **blocked**;
`/admin` → platform client **allowed**; `/admin` → raw prisma **blocked**.

### Isolation suite (45 → 49)

DES-26 is the first feature that *means* to read across firms, so the suite now asserts
both halves. Previously it could only catch a leak; a change that broke cross-firm reads
entirely would have kept it green while the console silently showed one firm. It now
checks that the platform client sees both firms where each tenant client sees one, that
it refuses every non-operator session, that `listFirms` attributes counts and activity to
the right firm rather than summing the platform, and that name/status filters narrow in
the database.

### Two DRY extractions the work turned up

- **`isUnder` was already in `middleware.ts`**, private. `NavLinks` needed the same rule,
  so it moved to `src/lib/routes.ts` and both use it. This *fixed a latent bug*: the firm
  nav used a bare `startsWith`, so `/admin` would have matched `/administration` and
  `/admin/firms` matches `/admin/firms-archive`. One rule, one place, tested.
- **`NavLinks`** carries the active-section styling for both headers, per the decision
  above. It also adds `aria-current="page"`, so "which tab is selected" is available to
  assistive tech rather than being carried only by a background colour.

### Not verified visually

The acceptance criterion asks for brand-consistent and responsive. The markup reuses the
existing table/`card`/palette classes verbatim from the projects list, and the build is
clean — but nobody has *looked* at it, because doing so means signing in and I don't type
passwords into forms. A throwaway preview database (four firms across all four statuses,
plus an operator account) is available for a human to check; see the PR description.
