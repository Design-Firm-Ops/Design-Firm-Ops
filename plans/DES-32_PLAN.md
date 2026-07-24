# DES-32 — DRY Review

**Linear:** [DES-32](https://linear.app/design-firm-ops/issue/DES-32/dry-review) · milestone _Initial Refactor_
**Status:** ✅ implemented. See "What shipped" at the bottom for what landed and what was deliberately left.

## Goal

> Explore the code base to find repeated code segments, UI elements, etc… extract for reuse.

I read all of `src/` (~14.7k lines: 65 API routes, ~45 components, 18 lib modules) and
inventoried the actual repetition. This plan reports what I found, ranks it, and
proposes a phased extraction.

## Two things that block the "before you finish" checklist

Both pre-exist on `main`; flagging up front because CLAUDE.md's finish criteria assume
they're green.

1. **`npm test` is red on `main`.** 3 failures in `src/components/Nav.test.tsx`:
   `Nav` renders `NavSearch`, which calls `useRouter()`, but `Nav.test.tsx` mocks
   `next/navigation` with only `usePathname` → *"No `useRouter` export is defined on
   the `next/navigation` mock."* This is itself a DRY defect: `src/test/mocks.ts`
   already exports `createRouterMock()`, and `Nav.test.tsx` hand-rolls a partial mock
   instead. Phase 6 fixes it.
2. **`npm run lint` cannot run.** There is no ESLint config anywhere (no
   `.eslintrc*`, no `eslint.config.*`, no `eslintConfig` in `package.json`), so
   `next lint` drops into its interactive "How would you like to configure ESLint?"
   prompt and hangs. See Open Questions.

## Findings, ranked

Counts are from the codebase as it stands today.

### Tier 1 — Business logic (highest value; CLAUDE.md says this belongs in `src/lib`)

| # | Finding | Sites |
|---|---|---|
| 1.1 | **"Invoice → extended prices → totals" is re-derived in 8 places.** `computeInvoiceTotals` is called with a hand-built `extendedPrices` array in `financials.ts` (×2), `invoiceStatus.ts`, `api/invoices/[id]/send`, `pdf/InvoiceDocument.tsx`, and `InvoicesTab.tsx` (×3). Each rebuilds the same item→`priceLine`→`.extended` mapping and the same PROCUREMENT-vs-DESIGN_FEE branch. `financials.priceItem()` exists to do exactly this, but only `financials.ts` uses it. | 8 |
| 1.2 | **`summarizeProjectFinancials` and `summarizeDesignFee` are structurally identical** (`financials.ts:27` / `:67`) — filter non-VOID invoices of one type → sum grand totals → filter payments of the matching category → sum → subtract. Only the type/category pair differs. | 2 |
| 1.3 | **Float money math.** `PaymentsTab.tsx:80` — `payments.reduce((sum, p) => sum + Number(p.amount), 0)`. Violates the "never floating-point for money" rule; every other total in the app goes through `decimal.js`. | 1 |
| 1.4 | **`nextOrder` (max-order + 1) pattern** — `aggregate({ _max: { order: true } })` then `(maxOrder._max.order ?? -1) + 1`, spread across `lib/feeStructure.ts`, `lib/itemType.ts`, `lib/room.ts` and 6 API routes. | 11 |

### Tier 2 — API route boilerplate (65 routes)

| # | Finding | Sites |
|---|---|---|
| 2.1 | **Zod parse + 400 block**, verbatim: `const body = await req.json(); const parsed = X.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });` | 47 |
| 2.2 | **Auth preamble** `const { unauthorized } = await requireSession(); if (unauthorized) return unauthorized;` — already helper-backed, but the 3-line shape repeats in every handler. | 64 files |
| 2.3 | **The four `reorder` routes are byte-identical** except the auth helper and the Prisma model: `item-field-defs/reorder`, `project-field-defs/reorder`, `pipeline-stages/reorder`, `procurement-lists/reorder`. | 4 files |
| 2.4 | **The item/project custom-field API is duplicated wholesale.** `item-field-defs/route.ts` vs `project-field-defs/route.ts` and `item-field-defs/[id]/route.ts` vs `project-field-defs/[id]/route.ts` are identical modulo the entity name (verified by diff). `items/[id]/field-values` vs `projects/[id]/field-values` differ only in the model + compound-key names. **Decided: not extracting a factory — these are expected to diverge.** See Phase 2. | 6 files |
| 2.5 | `NextResponse.json({ error: 'Not found' }, { status: 404 })` and `NextResponse.json({ ok: true })` repeated inline. | 26 / ~20 |

### Tier 3 — Client fetch layer

| # | Finding | Sites |
|---|---|---|
| 3.1 | **Hand-written JSON fetch**: `fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x) })` across 24 components. | 49 |
| 3.2 | **Error extraction**: `const data = await res.json().catch(() => null); setError(data?.error ? JSON.stringify(data.error) : '<fallback>')`. Note the `JSON.stringify` — this renders a raw Zod `flatten()` blob (`{"formErrors":[],"fieldErrors":{...}}`) straight into the UI. Centralizing it lets us format Zod errors readably in **one** place instead of 44. | 44 |

### Tier 4 — UI elements

| # | Finding | Sites |
|---|---|---|
| 4.1 | **Hand-rolled modal overlay** — `fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4` (±`overflow-y-auto … py-8`) wrapping a `card` panel, across 15 files. `ConfirmDialog` is the only one that's a component. | 17 |
| 4.2 | **Form field label** — `className="mb-1 block text-sm font-medium text-brown"` (plus 26 more at `text-xs`). No `.label` class exists in `globals.css`. | 116 (+26) |
| 4.3 | **Table shell** — `card overflow-x-auto` → `min-w-full divide-y divide-taupe/30 text-sm` → `thead` with `bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe` → `tbody divide-y divide-taupe/20` → `colSpan` empty-state row. | 11 tables |
| 4.4 | **Tab strip** — `ProjectTabs.tsx` is a proper reusable component, but `VendorDetailTabs`, `ProcurementTabs`, and `BusinessDevTabs` each re-implement the same `border-b-2 border-gold` active-tab markup inline. | 4 |
| 4.5 | **`ItemDocumentsSection` and `LeadDocumentsSection` are ~95% identical** — same state shape, same `load()`, same upload/delete handlers, same list markup. Differences: endpoint URLs, heading text, empty-state copy, and the extra FormData fields. | 2 (87 + 83 lines) |
| 4.6 | **`.eyebrow` already exists in `globals.css`** (`text-[11px] font-medium uppercase tracking-[0.24em] text-taupe`) but 35 sites hand-write the same treatment at `text-xs`. A source of truth exists and is being bypassed. | 35 |
| 4.7 | **Custom-field rendering** — the `fieldType` → input `switch` (TEXT/NUMBER/DATE/CURRENCY/RICH_TEXT) is duplicated between `ItemCustomFields.tsx` and `ProjectCustomFields.tsx`. | 2 |
| 4.8 | **Date formatting** — `new Date(x).toLocaleDateString()` inline in 7 components, with a different format again in `InvoiceDocument.tsx` and `invoices/[id]/send`. No `formatDate` helper exists alongside `formatMoney`. | 9 |
| 4.9 | Modal footer `flex justify-end gap-3` + Cancel/Submit with `{saving ? 'Saving…' : 'Save'}`. | 15 / 26 |

### Tier 5 — Validation schemas

| # | Finding | Sites |
|---|---|---|
| 5.1 | `z.string().optional().or(z.literal(''))` in `validation.ts`. | ~60 |
| 5.2 | `z.string().email().optional().or(z.literal(''))`. | 5 |
| 5.3 | `z.string().min(1, 'Name is required')`. | 8 |
| 5.4 | `z.preprocess((v) => (v === '' \|\| v === null \|\| v === undefined ? null : v), …)` — the empty-string→null number coercion. | 2 |

### Already DRY — leaving alone

`lib/supabase.ts` (bucket/signed-URL helpers already factored), `lib/pricing.ts`,
`lib/prisma.ts`, `lib/apiAuth.ts`, `lib/invoiceColumns.ts`, `src/test/`. Noting these so
the review shows the sweep was complete, not selective.

## Proposed work — phased

Each phase is independently valuable and independently reviewable. **TDD throughout:**
every new `src/lib` module gets its tests written first; the extracted UI components get
component tests before the call sites are migrated.

### Phase 0 — ESLint config *(decided: in scope)*
- Add `.eslintrc.json` extending `next/core-web-vitals` so `npm run lint` runs instead of
  dropping into `next lint`'s interactive setup.
- Done **first**, so every later phase can be linted as it lands.
- Expect pre-existing warnings across untouched files. I'll fix what this PR touches and
  report the remainder in the PR description rather than expanding scope to chase them.

### Phase 1 — Invoice/financial logic → `src/lib` *(recommended: yes)*
- Add `invoiceExtendedPrices(invoice, project)` and `invoiceTotals(invoice, project)` to
  `lib/financials.ts`, owning the PROCUREMENT-vs-DESIGN_FEE branch once.
- Collapse `summarizeProjectFinancials`/`summarizeDesignFee` onto one internal
  `summarizeLedger({ invoiceType, paymentCategory })`; keep both public names and their
  current return shapes so callers don't change.
- Migrate all 8 call sites (incl. `InvoicesTab.tsx`, `InvoiceDocument.tsx`,
  `invoiceStatus.ts`, `send/route.ts`).
- Fix the float money math in `PaymentsTab.tsx:80` to use `decimal.js` + `formatMoney`.
- Add `nextOrder(delegate, where?)` to a new `lib/order.ts`; migrate all 11 sites.
- **Tests first:** ledger roll-up (void invoices excluded, wrong-type invoices excluded,
  category-filtered payments, outstanding), design-fee vs procurement totals, `nextOrder`
  on an empty table (→ 0) and a populated one. Extend `pricing.test.ts`'s reference-invoice
  test to assert the new `invoiceTotals` reproduces it to the cent.
- **Risk:** touches money. Mitigated by the existing reference-invoice test staying green
  and by keeping public signatures unchanged.

### Phase 2 — API route helpers *(recommended: yes)*
- `lib/apiRoute.ts`: `parseBody(req, schema)` (returns `{ data }` or `{ response }`),
  `notFound()`, `ok()`, `badRequest()`.
- `lib/apiRoute.ts`: `reorderHandler(delegate, { admin })` → the four reorder routes each
  become a 3-line file.
- **Custom-field routes (2.4): no factory.** Since item and project custom fields are
  expected to diverge, the 6 route files stay as 6 files. They get the same treatment as
  every other route — `parseBody`, `notFound`, `ok`, `nextOrder` — which removes the
  boilerplate half of the duplication while leaving each entity free to grow its own
  rules. The remaining overlap is deliberate.
- Migrate the 47 `safeParse` blocks.
- **Tests first:** `parseBody` (valid → data, invalid → 400 with `flatten()`, malformed
  JSON → 400 rather than an unhandled throw — today `await req.json()` on a bad body
  throws), and the reorder handler.
- **Note:** today a malformed request body produces an unhandled exception. `parseBody`
  fixes that uniformly — a small behavior change, called out for review.

### Phase 3 — Client fetch layer *(recommended: yes)*
- `lib/apiClient.ts`: `apiSend(url, method, body)` and `apiError(res, fallback)`.
- `apiError` formats a Zod `flatten()` into readable text instead of `JSON.stringify`,
  fixing the raw-blob-in-the-UI problem in all 44 places at once.
- Migrate the 49 fetch sites.
- **Tests first:** `apiError` against a Zod flatten payload, a `{ error: "string" }`
  payload, a non-JSON body, and an empty body.

### Phase 4 — Shared UI *(recommended: partial — see below)*
- `components/Modal.tsx` — overlay + panel + optional `overflow-y-auto`, `maxWidth` prop,
  Escape-to-close, focus trap. Refactor `ConfirmDialog` to sit on it, then migrate the
  other 16 overlays.
- `components/Field.tsx` (label + control + error) **or** a `.label` class in
  `globals.css`. Recommend the CSS class for the 116 plain cases and a `<Field>` only
  where an error slot is needed — a component wrapper around 116 call sites is a much
  bigger diff for less gain.
- `components/DataTable.tsx` — the table shell + header row + empty state. Column
  definitions stay with the caller.
- `components/Tabs.tsx` — promote `ProjectTabs` to `src/components/`, migrate the 3
  inline tab strips.
- `components/AttachedDocuments.tsx` — one component behind `ItemDocumentsSection` and
  `LeadDocumentsSection`.
- `components/CustomFieldInput.tsx` — the shared `fieldType` → input switch.
- `lib/format.ts` — `formatDate` next to `formatMoney`; migrate the 9 sites. (Worth
  noting: `new Date('2026-01-15').toLocaleDateString()` renders the *previous* day west
  of UTC. Centralizing lets us fix that once — flagging as a behavior change to confirm.)
- Replace the 35 hand-written eyebrow treatments with `.eyebrow`. **Caveat:** `.eyebrow`
  is `text-[11px]`, the inline sites are `text-xs` (12px) — a 1px visual change on 35
  labels. See Open Questions.
- **Tests first:** `Modal` (renders when open, not when closed, Escape closes, backdrop
  click closes), `DataTable` (renders rows, renders empty state with correct colSpan),
  `Tabs` (switches panels, hides omitted tabs), `AttachedDocuments` (loads, uploads,
  surfaces an upload error) — using the existing `renderWithProviders` / `mockFetch`.

### Phase 5 — Validation schema helpers *(recommended: yes — small)*
- `optionalText()`, `optionalEmail()`, `requiredName(label)`, `nullableNumber()` at the top
  of `validation.ts`; apply throughout. Pure mechanical substitution, no behavior change.
- **Tests first:** a small `validation.test.ts` pinning each helper's accept/reject set
  (there is no test file for `validation.ts` today).

### Phase 6 — Test-infra DRY + the red build *(recommended: yes — small)*
- Add `mockNextNavigation({ pathname })` to `src/test/mocks.ts`, returning a complete
  `next/navigation` mock (`useRouter`, `usePathname`, `useSearchParams`, `useParams`).
- Use it in `Nav.test.tsx` → **fixes the 3 failing tests**; migrate `NavSearch.test.tsx`
  and `StatusFilter.test.tsx` onto it.

## Suggested scope for this PR

Phases **1, 2, 3, 5, 6** plus the **`Modal`**, **`AttachedDocuments`**, **`Tabs`** and
**`formatDate`** pieces of Phase 4. That covers every high-count finding while keeping
the diff reviewable.

I'd **defer** the rest of Phase 4 (`DataTable`, the 116-site label migration, the
`.eyebrow` change) to a follow-up issue — they're the widest-touching and the most
purely cosmetic, so they'd dominate the diff and make the logic changes hard to review.
Happy to fold them in if you'd rather have it all at once.

## Test strategy

- Every phase writes tests before implementation, per CLAUDE.md.
- New `src/lib` modules get `*.test.ts` (node env); new components get `*.test.tsx`
  (jsdom).
- No existing test is weakened or removed. `pricing.test.ts`'s reference-invoice test is
  the guardrail for Phase 1.
- Target: `npm test` green — which, note, means **going from 3 failures to 0**, not
  holding at green.

## Risks

- **Phase 1 touches money.** Highest-risk phase; mitigated by tests-first and unchanged
  public signatures. Reviewable independently of everything else.
- **Phase 2 changes malformed-body behavior** from a 500-ish unhandled throw to a clean
  400. An improvement, but a behavior change.
- **Phase 3 changes error text users see** (readable message instead of a JSON blob).
  Also an improvement, also a visible change.
- **Over-abstraction.** Largely defused by the 2.4 decision — the one place a factory
  would have locked two diverging entities together is now explicitly out. The remaining
  extractions are all one-concept-one-owner.

## Decisions

- **ESLint** — in scope, as Phase 0. _(2026-07-24)_
- **Custom-field routes (2.4)** — no route factory; item and project custom fields are
  expected to diverge, so they share only the generic route helpers. _(2026-07-24)_

## Open questions

1. **Scope.** Confirm the suggested split above (Phases 0–3, 5, 6 + the `Modal` /
   `AttachedDocuments` / `Tabs` / `formatDate` pieces of Phase 4), or tell me to include
   all of Phase 4.
2. **`formatDate` timezone (4.8).** Date-only values currently render a day early west of
   UTC. Fix as part of centralizing, or keep byte-identical output and file separately?
3. **`.eyebrow` (4.6).** Only applies if all of Phase 4 is included — standardizing the
   35 inline labels onto the existing class changes them from 12px to 11px. Fine, or
   should `.eyebrow` gain a `text-xs` variant so the change is purely structural?

---

## What shipped

All phases landed. `npm test` **111 passing (was 35 passing / 3 failing)**,
`npm run lint` clean, `npm run build` succeeds.

### New shared modules

| Module | Replaces |
|---|---|
| `lib/financials.ts` — `priceItem`, `invoiceExtendedPrices`, `invoiceTotals`, one `summarizeLedger` behind both public summaries | 8 re-derivations of invoice totals; 2 near-identical ledger roll-ups |
| `lib/order.ts` — `nextOrder(model, where?)` | 11 copies of `max(order) + 1` |
| `lib/apiRoute.ts` — `parseBody`, `ok`, `badRequest`, `forbidden`, `notFound`, `conflict`, `applyOrder` | 47 Zod parse blocks, ~90 inline error responses, 4 reorder routes |
| `lib/apiClient.ts` — `apiSend`, `apiError` | 65 hand-written fetches, 44 error-extraction blocks |
| `lib/format.ts` — `formatDate`, `formatLongDate` | 9 inline date formats |
| `lib/money.ts` — `sumMoney` | float money math + 2 inline reducers |
| `components/Modal.tsx` | 17 hand-rolled overlays |
| `components/Tabs.tsx` (promoted from `ProjectTabs`) | 2 tab strips |
| `components/AttachedDocuments.tsx` | `ItemDocumentsSection` + `LeadDocumentsSection` (both deleted) |
| `validation.ts` — `optionalText`, `optionalEmail`, `requiredName`, `nullableNumber`, `nullableInt`, `reorderSchema` | ~90 inline field definitions |
| `test/mocks.ts` — `nextNavigationMock` + `mockNextNavigation` | 3 partial, hand-rolled navigation mocks |

### Behavior changes (all intentional)

1. **Malformed JSON request bodies now return 400** instead of throwing. Every
   other status code is unchanged — verified per-route against `main`.
2. **Validation errors render readably.** `apiError` formats a Zod `flatten()`
   as `name: Name is required; email: Invalid email` instead of putting the raw
   `{"formErrors":…}` blob on screen.
3. **`PaymentsTab` totals use `decimal.js`.** Was `sum + Number(p.amount)` — the
   one float-money violation in the codebase.
4. **Date-only values render the day they name.** `new Date('2026-01-15')`
   parses as UTC midnight, so project start dates / payment dates / due dates
   rendered a day early west of UTC. `formatDate` pins them to local midnight.
5. **`ConfirmDialog` closes on Escape / backdrop click** (never while busy;
   dismissal is always cancel). Other dialogs keep their existing behavior —
   they can opt in by passing `onClose` to `Modal`.
6. **Pipeline stages start at order 0**, not 1. `pipeline-stages` was the only
   route using `?? 0` where its ten siblings used `?? -1`; only reachable on an
   empty board, which the UI can't produce (board creation always seeds a stage).

Schemas were verified unchanged by a temporary differential test running all 36
against `main`'s versions over 28 payloads — accept/reject, coerced output, and
error shape all identical. That scaffolding was removed once green.

### Deliberately not extracted

- **Custom-field routes** (finding 2.4) — per your call that item and project
  custom fields will diverge. They share only the generic route helpers, so the
  6 files stay 6 files.
- **`BusinessDevTabs` / `ProcurementTabs`** — both have inline rename and delete
  affordances *inside* each tab button. Folding them into `Tabs` would need a
  `renderLabel` escape hatch that reintroduces most of the complexity for two
  callers that still differ (pencil button vs double-click, board cap vs none).
  They're a different widget, not the same one repeated.
- **The image lightbox** in `ItemDetailModal` — custom click-to-close overlay,
  not a card panel.

### Still open (follow-up candidates)

- `DataTable` shell (11 tables), the 116-site form-label class, and `.eyebrow`
  standardization — deferred as planned; they're the widest-touching and most
  purely cosmetic.
- 3 `<img>` → `next/image` lint warnings remain. Converting them needs
  `remotePatterns` config for Supabase signed URLs — out of scope here.
