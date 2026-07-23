# Design Firm Ops — High-Level Plan

_Consolidated from the original build prompts and the July 22, 2026 project-context
handoff. This is the single orientation doc: what we're building, what exists, what's
left, and the rules that must never drift. For dev conventions see
[../CLAUDE.md](../CLAUDE.md); for setup see [../README.md](../README.md)._

---

## 1. What this is

**Design Firm Ops (DFO)** — an internal operations app covering an interior design
firm's full engagement lifecycle: **business-development leads → projects → FF&E
procurement → vendor/trade accounts → invoicing → payments**.

Originally built as **MDI Studio** for Madison Ditton Interiors (a luxury interior
design firm in Utah), it is now positioned as the foundation for a future **B2B SaaS
product for small interior design firms (<$3M revenue)**, branded Design Firm Ops.

- Two internal owner users today; roles are `ADMIN | DESIGNER`.
- **Clients never create accounts** — all client interaction happens through secure
  tokenized links (invoice/portal/contract signing).
- Repo: https://github.com/Dittontr/Design-Firm-Ops

### Stack (do not deviate)

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Prisma ORM → Postgres (hosted on Supabase)
- NextAuth (credentials provider, JWT sessions) — internal users only
- Supabase Storage (private buckets + signed URLs for documents/resources; public
  bucket for branding)
- Resend (transactional email)
- `@react-pdf/renderer` (invoice/contract PDF generation)
- `decimal.js` for **all** money math (never floats)
- Vitest + React Testing Library for tests
- Anthropic API (`claude-sonnet-4-6`) — reserved for the future document-extraction phase

---

## 2. Non-negotiable rules

### Money & pricing (the core of the business — get it exactly right)

- **Never use floating point for money.** All monetary math uses `decimal.js` /
  Prisma `Decimal`. Use `src/lib/pricing.ts`, `src/lib/money.ts`,
  `src/lib/financials.ts` — don't reimplement.
- Each line item: `unitCost` (what the firm pays the vendor), optional `platformFee`
  (per-unit, default 0), and a markup on top.
- Markup mode is stored per item/project: **markup %** (`price = cost × (1 + m)`) or
  **margin %** (`price = cost / (1 − m)`). Default **15% markup**, configurable per
  project, overridable per line item.
- `clientUnitPrice = (unitCost + platformFee) × (1 + markup)` → `extendedPrice =
  clientUnitPrice × qty`.
- Invoice totals: merchandise subtotal + shipping/freight (manual) + sales tax
  (configurable rate; **configurable base**: merch-only vs merch + shipping).
- **Rounding order:** round each unit price to the cent **first**, then extend by qty,
  then sum. Matches a human bookkeeper; enforced by pricing tests — keep them green.

### Reference invoice (the canonical acceptance test)

Westland Reserve project — 13 lighting items, 15% markup, $2,295.48 shipping, 7% tax
on merchandise only:

| Total | Value |
|---|---|
| Merchandise subtotal | **$19,287.85** |
| Shipping | **$2,295.48** |
| Tax (7%) | **$1,350.15** |
| Grand total | **$22,933.48** |

If it doesn't reconcile to the cent, the rounding order is wrong.

### Brand (use throughout, including PDFs)

- Colors: primary dark brown `#4a3728`, cream `#F7F3EE`, gold accent `#C49A5C`,
  taupe `#BCA88A`.
- Type: serif **Lora** (headings, invoice titles); sans **Poppins Light** (body).
- Invoice header: letterspaced serif title (e.g. `M E R C H A N D I S E   I N V O I C E`),
  logo block on dark brown.

### General

- Every destructive action gets a confirmation dialog.
- All money displayed as `$1,234.56`.
- Secrets (vendor trade-account passwords) encrypted at rest via `src/lib/crypto.ts`
  (AES-256-GCM) — never logged or returned decrypted to the client.
- Validate all API input with Zod (`src/lib/validation.ts`).
- DRY: business logic lives only in `src/lib`; routes/components call it. Shared UI in
  `src/components`. TDD: failing test first for new/changed logic.

---

## 3. Data model (current baseline)

- **User** (`ADMIN | DESIGNER`) — auth + permission gating.
- **Client** → has many **Project**s (multi-contact clients on the unmerged branch).
- **Project** — status (`LEAD/ACTIVE/ON_HOLD/COMPLETE`), fee structure
  (`FLAT_FEE/HOURLY/COST_PLUS/HYBRID`), default markup %/mode, sales tax rate/base,
  invoice prefix, per-project custom fields (`ProjectFieldDef`/`ProjectFieldValue` —
  the intended landing spot for future AI-extracted contract data).
- **Item** — project line item: category, room, vendor, offering, procurement list,
  qty, unit cost, platform fee, markup overrides, dimensions/finish/link, image,
  status (`PROPOSED→APPROVED→INVOICED→ORDERED→RECEIVED→DELIVERED`), custom fields
  (`ItemFieldDef`/`ItemFieldValue` — landing spot for AI-extracted vendor-PDF data).
- **ProcurementList** — user-defined sub-lists within a project's Procurement tab.
- **Vendor** — rep/showroom/account info, offerings, encrypted trade-account credentials.
- **Offering** — user-customizable product category shared by Vendor and Item.
- **Document** — polymorphic (Project XOR Lead, optionally tagged to an Item); private
  bucket, signed URLs, folder-organized.
- **Invoice** — merchandise invoices; **live-linked to items via `Item.invoiceId`**
  (no `InvoiceLineItem` snapshot table — deliberate); totals computed on the fly by
  `computeInvoiceTotals`. `portalToken` (Phase 4 portal) + `columnConfig` (client-facing
  column visibility).
- **Payment** — `MERCHANDISE` or `DESIGN_FEE` category; ACH/WIRE/CHECK/CREDIT_CARD/OTHER.
- **DesignFeeCharge** — separate ledger from merchandise invoices, summarized by
  `summarizeDesignFee()`.
- **LeadBoard** → **PipelineStage** → **Lead** — up to 5 kanban sales pipelines; a Lead
  converts to Client + Project when won. **ReferralPartner** tracked against Leads.
- **Resource** / **ResourceFolder** — firm-wide file library with per-folder access.
- **Settings** — singleton: company info, payment instructions, invoice branding colors,
  per-designer visibility toggles (financials, invoices, documents, vendor creds, etc.).

---

## 4. Phase roadmap & status

| Phase | Scope | Status |
|---|---|---|
| **1 — Data model, auth, projects, items** | Prisma baseline, NextAuth, projects, spreadsheet-style items table, vendors/clients CRUD, settings, seed. | ✅ Shipped |
| **2 — Invoicing** | Invoice model, builder, **column visibility**, PDF (branded), send via Resend, **item locking**, payment-status automation, void. | ✅ Shipped |
| **3 — Multi-tenancy & super-admin dashboard** | Turn the single-firm app into a multi-tenant SaaS: `Firm`/tenant model, tenant-scoped data + auth, `SUPER_ADMIN` role (single, deploy-seeded), and a cross-firm admin console to provision/manage/suspend firms and see platform-wide metrics. **Prioritized next** — the pivot toward the sellable SaaS product. | ⛔ Not started — see [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) |
| **4 — Contracts & e-signature (no client login)** | `Contract`/`Signer`/`ContractEvent`, tokenized `/portal/sign/[token]`, ESIGN consent, draw/type signature, final PDF = original + signature page + audit certificate (SHA-256 hash), reminders. | ⛔ Not started |
| **5 — Client payment portal** | Public token-gated `/portal/invoice/[portalToken]` matching the PDF (respecting `columnConfig`); **PaymentProvider interface** (`ManualPaymentProvider` now, `PlutosPaymentsProvider` stub, swap via `PAYMENT_PROVIDER` env); partial payments/deposits; optional read-only `/portal/project/[token]` with `clientShared` gating. | ⛔ Not started (data model partly ready: `portalToken`, `columnConfig`) |
| **6 — AI document ingestion** | Upload vendor invoice (PDF/image) or client presentation (PDF) → Anthropic API extraction → **mandatory review screen** (never auto-commit) → populate Items with `sourceDocument`; fuzzy-match actual costs to existing items. | ⛔ Not started (`*FieldDef`/`*FieldValue` schema anticipates it; `ANTHROPIC_API_KEY` wired but unused) |
| **7 — Polish & reporting** | Dashboard KPIs, project P&L, global search, branded email templates, per-project activity log, XLSX export, backup/deploy docs. | ◐ Partial (global search exists; rest TBD) |

> **Phase order note:** phases 3–7 were resequenced to put multi-tenancy first (it was
> originally scoped as Phase 7). Numbers now match execution order and the Linear
> milestones.

### Phase-2 details worth remembering (already built)

- Invoice is **live-linked, not snapshotted** (`Item.invoiceId` FK). No snapshot table
  — deliberate decision.
- **Item locking**: an item is locked the moment it's attached to an invoice (even
  DRAFT). Edits rejected with a clear message; explicit `unlockOverride: true` on the
  PATCH bypasses it (permission-gated + confirm dialog). Removing an item goes through
  voiding/editing the invoice, which detaches items and reverts them to `APPROVED`.
- **Column visibility** enforced **server-side** in the PDF/portal renderer — never
  expose vendor name or cost when hidden. Presets: "Show markup transparently",
  "Price only", "Minimal". Per-invoice config with a project-level default.
- **Payment-status automation**: sum merchandise payments vs grand total →
  `PARTIALLY_PAID`/`PAID`, and back down on correction. Reject payments against `VOID`.
- Invoice numbering: `{project.invoicePrefix}-{seq}` (e.g. `2506-001`), sequential per
  project. Design fees do **not** invoice through this model — they're a separate ledger.

---

## 5. Branch state — already reconciled (no action needed)

An earlier draft of this doc flagged a branch-reconciliation task. **A code audit
(July 23, 2026) disproved it** — there is nothing to merge:

| Branch | Reality |
|---|---|
| `main` | Current. Holds all shipped work (Phases 1–2, brand, `npm run setup`, first unit tests, `CLAUDE.md`). |
| `claude/mdi-studio-status-7gc184` | Tip is `2e83fa6`, a **strict ancestor of `main`** with **no unique commits**. `git merge-base --is-ancestor` confirms it. The apparent "extra features" it seemed to carry are already on `main`; a `diff --stat main..branch` shows only deletions (files added to `main` afterward). Safe to delete. |
| `claude/mdi-studio-setup-r3c3qd` | Also fully contained in `main` (empty `main..branch` log). Stale — safe to delete. |

**Action:** none required for reconciliation. Optionally delete the two stale branches.
Build new work off `main`.

---

## 6. Explicitly NOT built yet

- **Contracts & e-signature** (Phase 3) — no schema/flow exists.
- **Client payment portal** (Phase 4) — `portalToken`/`columnConfig` exist; the portal
  page, PaymentProvider interface, and Plutos stub do not.
- **AI document extraction** (Phase 5) — `*FieldDef`/`*FieldValue` anticipate it;
  `ANTHROPIC_API_KEY` wired but unused; no extraction code.
- **Linear MCP integration** — referenced in `CLAUDE.md` as the issue-workflow source,
  marked "to be configured"; not yet wired up.
- **Multi-tenant / firm-agnostic SaaS layer + super-admin dashboard** (Phase 7) —
  schema and seed are still single-firm (singleton `Settings` at `id:1`, no `firmId` on
  any entity, roles limited to `ADMIN | DESIGNER`). Becoming the sellable DFO product
  needs a tenancy model, a `SUPER_ADMIN` role, and a cross-firm management console. Fully
  scoped in [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md).

---

## 7. Suggested next steps (in order)

1. **Phase 3 (multi-tenancy & super-admin dashboard)** — prioritized next; the biggest
   architectural change and the pivot from MDI's internal tool to the sellable DFO SaaS
   product. **Foundation-first** (tenancy model + isolation proven before the dashboard).
   See [ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md); resolve its §6 open questions before
   starting DES-23.
2. **Phase 4 (contracts & e-signature)** or **Phase 5 (payment portal)** — the
   client-facing lifts; both have partial data-model groundwork.
3. **Phase 6 (AI document extraction)** — the `*FieldDef`/`*FieldValue` and
   `Item.sourceDocument` placeholders already anticipate it.
4. **Finish Phase 7 (polish & reporting)** — dashboard KPIs, firm-wide P&L view, activity
   log, XLSX export, invoicing test coverage.

_Branch reconciliation (previously listed first here) is done — see §5._
