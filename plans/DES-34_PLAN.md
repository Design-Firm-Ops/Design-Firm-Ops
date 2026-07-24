# DES-34 — Test Coverage Gap Filling

**Linear:** [DES-34](https://linear.app/design-firm-ops/issue/DES-34/test-coverage-gap-filling) · milestone _Initial Refactor_
**Status:** ✅ implemented. See "What shipped" at the bottom.

## Goal

> Review the application and unit test for gaps in coverage and write tests to fill them.

I installed `@vitest/coverage-v8` and measured, rather than guessing where the holes are.

## Baseline (branched off `main`, with DES-32/33 merged)

```
Statements   9.11%  (351/3850)
Branches     7.97%  (214/2685)
Functions   10.32%  (116/1124)
Lines        9.30%  (317/3408)
```

138 tests across 17 files. That 9% is misleading in both directions: it's dragged down by
65 API routes and 8 page components that are 0% and aren't unit-testable, and it hides
the fact that the *pure* layer is already decent (`src/lib` is 81.9%).

Coverage by area:

| Area | Stmts | Note |
|---|---:|---|
| `src/lib` | 81.9% | The pure domain layer — mostly good, specific holes below |
| `src/components` | 67.8% | Shared UI |
| `src/server/storage` | 72.5% | Added in DES-33 with tests |
| `src/server` (rest) | 1.7% | Essentially untested — needs a Prisma double |
| `src/server/queries` | 0% | Thin read wrappers |
| `src/app/api` (65 routes) | 0% | See "Not proposed" |
| `src/app/app` (pages/components) | ~0% | Server components + large client components |

## Findings — what's actually missing

### Tier 1 — Pure logic at 0%, with real consequences

| Module | Why it matters |
|---|---|
| **`lib/invoiceColumns.ts`** | Decides **what the client sees on an invoice**. `resolveColumnConfig` implements invoice-override → project-default → built-in precedence, and `isValidConfig` rejects unknown column keys. The module's own comment claims vendor name and internal notes "aren't in this list at all, so there's no config that can expose them" — that's an untested claim about a confidentiality guarantee. |
| **`lib/itemLock.ts`** | The rule that an item attached to an invoice is locked. Derived from `invoiceId` rather than stored, so it can't drift — but nothing pins that. |
| **`lib/domain.ts`** | `isDocumentType` gates what `POST /api/documents` will accept; `isProjectStatus` filters the projects list. Type guards used as input validation, untested. |
| **`server/json.ts`** | `jsonOrNull` — must distinguish `undefined` (don't touch the column) from `null` (clear it). Getting that backwards silently wipes a project's invoice column config. |
| **`server/storage/index.ts`** | `storagePath` and `removeQuietly`. I added both in DES-33 and tested the adapter but not these two helpers — my gap to close. |
| **`server/itemType.ts`** → `generateUniquePrefix` | Three-tier collision avoidance (initials → first-letter pairs → numbered suffix) generating the tag prefixes users see on every line item. Non-trivial, zero coverage. |

### Tier 2 — Partial coverage with meaningful branch gaps

- **`lib/crypto.ts`** (90.9% stmts / 77.8% branch) — the two `getKey()` throws are uncovered: missing `CREDENTIALS_ENCRYPTION_KEY` and a key that isn't 32 bytes. That's the misconfiguration path for encrypted vendor passwords; it should fail loudly and provably.
- **`lib/financials.ts`** (75% branch) — the `summarizeLedger` paths.
- **`lib/apiClient.ts`** (83% branch), **`lib/format.ts`** (92.9% branch).
- **`components/Modal.tsx`** (92% branch), **`AttachedDocuments.tsx`** (87.5% branch),
  **`NavSearch.tsx`** (74% stmts / 62.5% branch — debounce and keyboard paths).

### Tier 3 — Server modules at 0%, blocked on missing test infrastructure

There is no Prisma test double, so nothing in `src/server/` that queries can be tested at
all. Adding one to `src/test/` unlocks:

- **`server/invoiceStatus.ts`** — `recalculateInvoiceStatus`: payments vs. grand total →
  `PAID` / `PARTIALLY_PAID` / falls back to `SENT` or `DRAFT`, and **never touches a VOID
  invoice**. Status moves in both directions (correcting a payment down un-PAIDs an
  invoice). This is the highest-value untested logic in the app.
- **`server/invoiceNumber.ts`** — per-project, per-type sequences that must not collide
  between Procurement and Design Fee invoices.
- **`server/itemTag.ts`** — per-project tag numbering.
- **`server/feeStructure.ts` / `projectType.ts` / `room.ts`** — find-or-create.
- **`server/permissions.ts`** — the loader (the policy is already covered).

### Tier 4 — Components at 0%

- **`components/Tabs.tsx`** — I promoted this in DES-32 without tests. It has real
  behaviour: active-tab selection, tab omission for permission gating, the empty state.
- **`components/Tooltip.tsx`** — small.
- **`lib/pdf/richTextToPdf.tsx`** — 98 lines of rich-text → PDF-node parsing. Real
  parsing logic, currently unverified.

## Proposed work

### Phase 1 — Tier 1 pure logic
Tests for `invoiceColumns`, `itemLock`, `domain`, `json`, `storage/index`, and
`generateUniquePrefix`. Fast, no mocking, highest value per line.

`generateUniquePrefix` is currently module-private; I'd export it so it can be tested
directly rather than driven through a database call.

### Phase 2 — Tier 2 branch gaps
Fill the uncovered branches in `crypto`, `financials`, `apiClient`, `format`, `Modal`,
`AttachedDocuments`, `NavSearch`.

### Phase 3 — Prisma test double + Tier 3
Add `createPrismaMock()` to `src/test/`, in the same spirit as the existing
`mockFetch` / `mockNextNavigation` helpers: one import, no per-test scaffolding. Then test
`invoiceStatus`, `invoiceNumber`, `itemTag`, the find-or-create helpers, and the
permissions loader.

### Phase 4 — Tier 4 components
`Tabs`, `Tooltip`, `richTextToPdf`.

### Phase 5 — Lock it in
Add coverage config to `vitest.config.ts` with **per-directory thresholds** on the layers
that should stay covered (`src/lib`, `src/server` excluding `queries/`), plus an
`npm run test:coverage` script. A single global threshold would be meaningless with 65
routes at 0%; per-directory thresholds actually prevent regression where it matters.

## Explicitly not proposed

- **The 65 API routes.** Testing them means mocking Prisma, next-auth, storage, and
  `NextRequest`/`NextResponse` per route — a large, brittle surface with low signal.
  The logic worth testing has already been extracted into `src/lib` and `src/server`
  modules by DES-32/33, and those *can* be tested cheaply. I'd rather spend the effort
  there and leave routes to an integration layer.
- **`lib/pdf/InvoiceDocument.tsx`** — 185 lines of React-PDF primitives. A snapshot would
  be high-churn and low-signal; the pricing it depends on is already well covered.
- **Large app client components** (`ItemsTable` 884 lines, `DesignFeeSection` 660, …).
  Worth testing eventually, but each needs substantial fixture setup; that's its own
  issue, not a gap-filling pass.
- **Trivial wiring** — `prisma.ts`, `Providers.tsx`, `auth.ts` config, `procurement.ts`
  (constants only).

## Expected outcome

Coverage on the layers that matter, not a headline number. Rough target: `src/lib` from
81.9% → mid-90s, `src/server` (excluding `queries/`) from ~2% → 70%+. The global figure
will stay low because of the routes, and that's the honest result — I'd rather report
that than chase a number by testing wiring.

## Risks

- **Tests that just restate the implementation.** The guard against it is testing
  observable behaviour and edge cases (VOID invoices, null-vs-undefined, prefix
  collisions) rather than line-by-line mirroring.
- **The Prisma mock could become a maintenance burden** if it tries to emulate Prisma.
  It will be a thin, explicit stub — you say what a call returns — not a fake database.

## Decisions

_(2026-07-24)_

- **Scope: all five phases**, including the Prisma test double.
- **Coverage thresholds: per-directory and CI-blocking** on `src/lib` and `src/server`
  (excluding `queries/`).

---

## What shipped

All five phases. **326 tests** (was 138), across 35 files (was 17).

### Coverage on the tested layers

Measured over `src/lib`, `src/server`, `src/components`, excluding wiring and
integration-shaped code (see `vitest.config.ts` for the exclusion list and why).

| | before | after |
|---|---:|---:|
| Statements | — | **97.52%** |
| Branches | — | **93.96%** |
| Functions | — | **96.71%** |
| Lines | — | **97.56%** |

Per-area statement coverage, before → after:

| Area | before | after |
|---|---:|---:|
| `src/lib` | 81.9% | **100%** |
| `src/server` (logic modules) | 1.7% | **99.1%** |
| `src/components` | 67.8% | **99.2%** |
| `src/server/storage` | 72.5% | **91.3%** |

The whole-repo figure went 9.11% → ~30%, and that number stays low by design:
65 API routes and 8 page components are 0% and excluded from the gate.

### New tests, by what they protect

- **`invoiceColumns`** — the confidentiality claim in its own header comment is now
  a test: no offered column can expose vendor, cost, profit, or internal notes, and a
  config naming an unknown column is rejected wholesale rather than passed through.
- **`invoiceStatus`** (18 tests) — the money-to-status rule, including that it
  *un-pays* an invoice when a payment is corrected downward, never touches a VOID
  invoice, ignores payments of the wrong category, and won't call a zero-total
  invoice PAID.
- **`auth`** — a deactivated user with the right password is still rejected; the
  password hash never leaves `authorize`; email is normalized so case can't lock
  someone out.
- **`apiAuth`** — 401 vs 403 are pinned as distinct, and an unrecognized role is
  denied rather than defaulting to allow.
- **`crypto`** — both key-misconfiguration throws, plus proof that a secret written
  under one key can't be read under another.
- **`generateUniquePrefix`** — all three collision tiers, plus a bulk property test
  that no prefix is ever issued twice.
- **`procurement`** — pins the real coupling that `itemSchema`'s default category
  ("Other Merchandise") must exist in the seeded procurement lists.
- Plus `itemLock`, `domain`, `json`, `storagePath`/`removeQuietly`, `numbering`,
  find-or-create helpers, the permissions loader, `email`, `Tabs`, `Tooltip`,
  `richTextToPdf`, and branch gaps in `financials`, `apiClient`, `format`, `Modal`,
  `AttachedDocuments`, `NavSearch`, and the Supabase adapter.

### New test infrastructure

`src/test/prisma.ts` — `mockPrisma()` / `prismaMock`, in the same spirit as the
existing `mockFetch` and `mockNextNavigation` helpers. Deliberately **not** a fake
database: it doesn't understand `where`, relations, or query semantics and shouldn't
grow to. You say what a call returns and assert on the decision the code made.
Anything needing real query semantics belongs in an integration test.

This is what unblocked `src/server` going from 1.7% to 99.1%.

### The gate

`vitest.config.ts` now carries coverage config with thresholds (95% statements /
90% branches / 95% functions / 95% lines) and `npm run test:coverage`.

Verified in both directions: adding an untested module fails the run with
`ERROR: Coverage for functions (93.63%) does not meet global threshold (95%)`
and exit code 1; removing it passes again. An unverified threshold is just a comment.

## Two notes for review

1. **One test documents behaviour I chose not to change.** `parseRichText` keeps a
   whitespace-only block (it renders as a deliberate blank line in the PDF) while
   dropping truly empty ones. That's defensible, and changing production behaviour
   inside a test-coverage issue would have been the wrong call — so it's pinned and
   commented instead.
2. **Two of the gaps filled were mine.** `Tabs.tsx` (promoted in DES-32) and
   `storage/index.ts` (added in DES-33) both shipped without direct tests.

## Scope notes — two deviations from this plan

1. **Thresholds are global-over-a-scoped-set, not per-directory.** The plan proposed
   per-directory thresholds. Vitest's v8 provider applies thresholds globally, so the
   equivalent — and simpler — approach is to scope *what is measured* via
   `coverage.include`/`exclude` and then gate that set globally. Same effect (the
   layers that matter can't regress, routes don't dilute the number), fewer moving
   parts. `coverage.thresholds` does support per-glob entries if we later want
   different bars per layer.
2. **`auth.ts` was tested after all.** The plan listed it under "trivial wiring". On
   reading it, `authorize()` is not wiring — it's the sign-in decision, including the
   deactivated-user check. It got 10 tests.
