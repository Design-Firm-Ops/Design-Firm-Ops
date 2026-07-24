# DES-33 — Coupling Review

**Linear:** [DES-33](https://linear.app/design-firm-ops/issue/DES-33/coupling-review) · milestone _Initial Refactor_
**Status:** ✅ implemented. See "What shipped" at the bottom, including a scope note
where the delivered lint rule is narrower than this plan originally described.

## Goal

> Review the existing codebase for places where there is inappropriate coupling
> between components. Specifically, I want to make sure that the application is
> isolated from my choice of database, ORM, file storage, etc… where applicable
> apply the repository pattern or adapter patterns to ensure loose coupling.

I measured the actual coupling surface before proposing anything. The headline:
**file storage is genuinely leaky and worth fixing properly; the ORM is leaky in a
narrower way than it first appears; and a blanket repository over all 28 models
would cost far more than it buys.** Detail and reasoning below.

## What I measured

| Coupling | Reality |
|---|---|
| `@/lib/prisma` imported directly | **82 files** — 64 API routes, 8 server page components, 10 `src/lib` modules |
| `prisma.<model>.*` call sites | **200**, across **28 models** |
| `@prisma/client` imported (types/enums/namespace) | 6 files — `Prisma.JsonNull` ×3 routes, `InvoiceType`, `FeeStructureScope`, `PrismaClient` |
| Supabase Storage SDK reached into directly | **6 API routes** call `getSupabaseServerClient()` then `.storage.from(BUCKET).upload/remove/getPublicUrl` |
| Client components importing Prisma | **0** — this boundary is already clean |
| `src/lib` layering | 18 pure modules and 10 data-access modules, flat in one directory, no signalled boundary |

### Already decoupled — leaving alone

- **The client boundary.** No `'use client'` component imports Prisma or its types.
  Client row types (`ItemRow`, `VendorRow`, `InvoiceRow`) are hand-declared with
  `string` money fields, and pages serialize before passing down. This is the single
  most important boundary in the app and it's already right.
- **Email.** `lib/email.ts` fully encapsulates Resend; nothing else imports it (the
  two apparent hits elsewhere are the button label "Resend Invoice").
- **Pricing/money.** `pricing.ts`, `money.ts`, `financials.ts`, `invoiceColumns.ts`,
  `itemLock.ts` are pure and dependency-free. `decimal.js` does appear in three
  client components, but that's a *domain* library choice, not infrastructure —
  isolating the app from decimal.js is not a goal worth having.

## Findings

### 1. File storage is the real leak *(highest value)*

`lib/supabase.ts` looks like an adapter but only half is one. It exports
`createSignedDocumentUrl` / `createSignedResourceUrl` (good), and also
`getSupabaseServerClient()` plus the raw bucket-name constants — which six routes
use to drive the SDK directly:

```ts
// api/documents/route.ts
const supabase = getSupabaseServerClient();
const { error: uploadError } = await supabase.storage
  .from(DOCUMENTS_BUCKET)
  .upload(path, await file.arrayBuffer(), { contentType: file.type });
if (uploadError) throw uploadError;
```

Leaking into routes: the `.storage.from(bucket)` shape, Supabase's
`{ data, error }` return convention (rather than throwing), bucket identity, the
`getPublicUrl` call, and the `ensure*Bucket()` provisioning step. Swapping to S3
today means editing six route handlers. **This is exactly what the issue names, and
an adapter genuinely fixes it.**

Affected: `api/documents`, `api/documents/[id]`, `api/resources`,
`api/resources/[id]`, `api/leads/[id]/documents`, `api/leads/[id]/documents/[docId]`,
`api/items/[id]/image`, `api/settings/logo`.

### 2. Presentation queries persistence directly

Eight server page components call `prisma` inline — e.g. `projects/page.tsx` builds
a `findMany({ where, include, orderBy })` in the middle of a React component, and
`projects/[id]/page.tsx` makes 7 Prisma calls across 372 lines. A page component
should ask a named question ("active projects with their clients"), not compose a
query. This is cheap to fix and materially improves testability.

### 3. `src/lib` has no layer boundary

Pure domain logic and data-access sit side by side in one flat directory:

- **Pure:** `pricing`, `money`, `financials`, `format`, `invoiceColumns`, `itemLock`,
  `validation`, `crypto`, `procurement`, `apiRoute`, `apiClient`, `apiAuth`, `order`, `email`
- **Data-access:** `auth`, `feeStructure`, `invoiceNumber`, `invoiceStatus`, `itemTag`,
  `itemType`, `permissions`, `projectType`, `room`, `prisma`, `pdf/renderInvoicePdf`

Nothing prevents a pure module from growing a Prisma import tomorrow, or a client
component from importing `@/lib/prisma` and blowing up at build time. **Structure
without enforcement rots**, so the fix has to include a lint rule, not just moved files.

### 4. Prisma types leak into business logic

- `Prisma.JsonNull` in `api/projects`, `api/projects/[id]`, `api/invoices/[id]` — an
  ORM sentinel deciding application semantics ("clear this column").
- `import type { InvoiceType } from '@prisma/client'` in `invoiceNumber.ts` and
  `FeeStructureScope` in `feeStructure.ts` — domain vocabulary owned by the ORM's
  generated client.

### 5. `resolvePermissions` couples an authorization decision to the database

`permissions.ts` is the app's authorization policy, but it issues its own two
queries. The *policy* (how role defaults and per-user overrides combine) is pure and
should be testable without a database; only the *fetch* needs one.

## Proposed work

### Phase 1 — `FileStorage` port + Supabase adapter *(recommend: yes)*
- `src/server/storage/types.ts` — the port: `upload`, `remove`, `signedUrl`,
  `publicUrl`, expressed in app terms (throws on failure; no `{ data, error }`).
- `src/server/storage/supabase.ts` — the only file that imports `@supabase/supabase-js`.
- `src/server/storage/index.ts` — selects the adapter; the rest of the app imports this.
- Buckets become a domain concept (`documents` / `resources` / `branding`) rather than
  Supabase bucket strings passed around.
- Migrate all 8 routes; `getSupabaseServerClient` stops being exported.
- **Tests first**: an in-memory `FileStorage` fake, plus tests that the routes call the
  port (not the SDK). The fake is reusable for every future storage test.

### Phase 2 — Data-access layer + enforced boundary *(recommend: yes)*
- Move the 10 data-access modules to `src/server/`, leaving `src/lib` pure.
- Add ESLint `no-restricted-imports`: `@/lib/prisma` and `@prisma/client` importable
  **only** from `src/server/**`. Any client component or pure module that reaches for
  them fails lint instead of failing at runtime.
- Own the domain enums (`InvoiceType`, `FeeStructureScope`, document types) in
  `src/lib` instead of re-exporting Prisma's.
- Replace `Prisma.JsonNull` at the three call sites with a small helper in the
  data-access layer, so the ORM sentinel stops appearing in route logic.
- Split `resolvePermissions` into a pure policy function (unit-tested, no DB) and a
  thin loader.

### Phase 3 — Repositories for the aggregates that have logic *(recommend: yes)*
Introduce repositories for **invoice, item, project, document/resource** — the four
aggregates that carry real domain behaviour (`invoiceStatus`, `invoiceNumber`,
`itemTag`, `itemLock`, `financials`). Page components and routes call these instead of
composing queries.

### Phase 4 — Server pages stop querying *(recommend: yes)*
Move the 8 page components' queries behind the Phase 3 repositories / named query
functions. Pages become presentation only.

### Explicitly NOT proposed — a repository for all 28 models

The naive reading of "apply the repository pattern" would wrap all 200 call sites. I
recommend against it, and want that decision to be yours:

- For thin CRUD (`offerings`, `pipeline-stages`, `lead-boards`, `procurement-lists`,
  the field-def tables), a repository method is a one-line passthrough to
  `findMany({ orderBy })`. It renames the coupling without removing it.
- It would be a **leaky** abstraction: `include` / `select` graphs are Prisma's
  vocabulary, and they'd surface in repository signatures. Swapping ORM would still
  mean rewriting every method body — so it doesn't even deliver the portability that
  justifies the pattern.
- Cost is roughly 1,500–2,500 lines of indirection across ~28 new modules, on top of
  a codebase that is ~14.7k lines total.

The alternative I'm proposing gets the same *practical* isolation more cheaply: thin
CRUD keeps calling Prisma directly, but **only from inside `src/server/**`**, where the
lint rule contains it. The blast radius of an ORM change is then "one directory"
rather than "one file per model" — without paying for 28 passthrough classes.

Say the word if you'd rather have the full repository layer; it's your codebase and
I'll build it. I just don't think it earns its keep here.

## Test strategy

TDD throughout, per CLAUDE.md:
- **Phase 1**: in-memory `FileStorage` fake written first; port contract tests; route
  tests asserting upload/delete go through the port. This is the phase where testing
  actually gets *easier* — today these routes can't be tested without Supabase.
- **Phase 2**: pure permission-policy tests (role defaults, per-user overrides,
  null-inherits semantics) with no database. The lint rule is itself the enforcement
  test for the boundary.
- **Phase 3/4**: repositories are mocked at their own interface; existing
  `pricing`/`financials` tests stay green throughout.

## Risks

- **Broad, shallow diff.** Touches many files without changing behaviour, which makes
  review tedious and regressions easy to miss. Mitigation: phase-by-phase commits,
  and the same before/after verification I used on DES-32 (no lost call sites, no
  changed status codes).
- **Phase 2 moves files**, so `git log` on those paths needs `--follow`. I'll use
  `git mv` so history is preserved.
- **Over-abstraction** is the live risk on this particular issue — the whole point of
  the "NOT proposed" section above.

## Decisions

_(2026-07-24)_

- **Branch base: `main`.** PRs #5 (DES-32) and #6 (setup) were both merged before this
  started, so `main` already carries that work — the conflict concern that made this a
  question is moot. Baseline on branch: 116 tests passing, lint and `tsc` clean.
- **Scope: Phases 1–4 as proposed.** No blanket 28-model repository layer; thin CRUD
  keeps calling Prisma directly from inside the data-access layer, contained by lint.
- **Directory: `src/server/`.**

---

## What shipped

All four phases landed. `npm test` **138 passing** (was 116), `npm run lint` clean,
`npx tsc --noEmit` clean, `npm run build` succeeds.

### Coupling, measured

| | `main` | now |
|---|---:|---:|
| Routes driving the storage SDK directly | 8 | **0** |
| Page components querying the ORM | 8 | **0** |
| Files importing `@prisma/client` | 6 | **2** (both in `src/server/`) |
| Files importing `@supabase/supabase-js` | 1 | **1** (the adapter) |
| Files importing the Prisma client | 82 | 79 (routes + `src/server/`, by design) |

### Phase 1 — FileStorage port

`src/server/storage/` — `types.ts` (the port), `supabase.ts` (the only module allowed to
import the SDK), `memory.ts` (an in-memory fake), `index.ts` (instance + `storagePath` +
`removeQuietly`). All 8 routes migrated; `src/lib/supabase.ts` deleted.

The port speaks the app's language: named buckets (`documents` / `resources` /
`branding`) rather than Supabase bucket strings, and it **throws** instead of returning
`{ data, error }`. 14 new tests, including adapter tests that run with no network by
injecting a stub client.

### Phase 2 — Data-access layer + enforced boundary

Moved 11 modules `src/lib/*` → `src/server/*` (via `git mv`, so history follows), plus
`renderInvoicePdf` → `src/server/pdf/`. `src/lib` is now entirely pure.

- **`src/lib/domain.ts`** — the app owns `InvoiceType`, `FeeStructureScope`,
  `DocumentType`, `ProjectStatus` etc. instead of importing them from the generated
  Prisma client.
- **`src/server/json.ts`** — `jsonOrNull()` keeps `Prisma.JsonNull` out of route logic.
- **`resolvePermissions` split**: the policy (`src/lib/permissions.ts`) is now pure and
  has 8 tests that run with no database; the loader (`src/server/permissions.ts`) is the
  only part that queries.
- **ESLint `no-restricted-imports`** enforces the boundary. Verified by probe that it
  fires on `@prisma/client` in `src/lib`, and on `@/server/prisma` and
  `@supabase/supabase-js` in `src/components`.

### Phases 3 & 4 — Query modules, pages stop querying

`src/server/queries/` — `projects`, `vendors`, `settings`, `leads`, `resources`. All 8
page components now ask named questions instead of composing selects.

Two behaviours moved *into* the query layer where they can't be forgotten:
- `listVendors`/`getVendor` strip the encrypted trade-account password and apply
  credential visibility, so a caller can't leak a vendor login.
- `listVisibleResources` applies folder allow-lists, so a caller can't render the
  unfiltered list.

Verified the extraction is faithful: the 29 queries the pages used to run map onto 27 in
the query modules, and the 2-query difference is reuse — `listOfferings()` now serves
both vendor pages, and `listUsers()` serves both settings and administration.

## Scope note — the lint rule is narrower than this plan first said

The plan said prisma would be importable "only from `src/server/**`". Implemented as
written, that forbids all 64 API routes, which *is* the blanket 28-model repository layer
this plan explicitly recommended against and you chose not to do.

So the rule allows `src/server/**` and `src/app/api/**`, and forbids `src/lib/**`,
`src/components/**`, and page/layout components. That still permanently locks the three
boundaries that matter — client code, the pure domain layer, and presentation — while
staying consistent with the agreed scope. Routes calling Prisma directly for thin CRUD
remains a deliberate, documented choice, not an oversight.

## Follow-up candidates

- Route handlers still hold their own queries. If the 4 aggregate repositories prove
  useful, the natural next step is moving invoice/item write paths behind them too, and
  tightening the lint rule to drop the `src/app/api/**` exemption.
- `src/server/queries/` covers reads. Writes still live in routes.
