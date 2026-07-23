# Design Firm Ops (DFO) — Project Context & Build Status
_Compiled from github.com/Dittontr/Design-Firm-Ops on July 22, 2026_

## 1. What this is

Design Firm Ops is a Next.js internal operations application originally built
for Madison Ditton Interiors (an interior design firm), covering the full
engagement lifecycle: business-development leads → projects → FF&E
procurement → vendor/trade accounts → invoicing → payments. It's being built
as the foundation for a future B2B SaaS product for small interior design
firms (<$3M revenue), branded Design Firm Ops.

**Repo:** https://github.com/Dittontr/Design-Firm-Ops (public, TypeScript 99.5%)

**Stack:**
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Prisma ORM → Postgres (hosted on Supabase)
- NextAuth (credentials provider, JWT sessions)
- Supabase Storage (private buckets + signed URLs for documents/resources; public bucket for branding)
- Resend (transactional email — sending invoices)
- @react-pdf/renderer (invoice PDF generation)
- decimal.js for all money math (never floats)
- Vitest + React Testing Library for tests
- Optional: Anthropic API, reserved for a future document-extraction phase

## 2. Branch situation (as of July 22, 2026) — read this first

There are three branches and they are **not in sync**. Before doing further
work, decide which branch to build from or merge them.

| Branch | Last commit | Status |
|---|---|---|
| `main` | 2026-07-22 — "some unit tests and claude setup" | Has: full Phase 1 + Invoicing Phase 2 + brand guidelines + local dev setup script (`npm run setup`) + first unit tests. **Missing** the newest feature work below. |
| `claude/mdi-studio-status-7gc184` | 2026-07-21 — "Add explicit item type creation, bulb qty..." | Has: everything `main` has through Invoicing Phase 2, **plus** four newer feature commits (permissions system, fee structures, procurement table rework, item types, multi-contact clients) that are **not merged to main**. But it's missing `main`'s later infra commits (README overhaul, `npm run setup` script, `.nvmrc`, and the first unit test files) since it branched off before those landed. |
| `claude/mdi-studio-setup-r3c3qd` | 2026-07-16 | Stale/superseded — earlier snapshot, safe to ignore or delete. |

**Net effect:** the most feature-complete code and the most current
infra/tooling live on two different branches that diverged at commit
`2e83fa6` ("Add invoicing Phase 2"). **The immediate next step for whoever
picks this up should be reconciling `main` and `claude/mdi-studio-status-7gc184`**
(likely: rebase/merge the status branch's 4 commits onto current `main`,
resolving conflicts in `ItemsTable.tsx`, `ProjectHeader.tsx`, `page.tsx`,
`DesignFeeSection.tsx`, `InvoicesTab.tsx`, `permissions.ts`, `validation.ts`,
and the Prisma schema/migrations, since both branches touched them
independently after the fork point).

## 3. Feature timeline (what's been built, in order)

1. **Phase 1** — data model, auth, projects, and items (core CRUD, NextAuth, Prisma schema baseline).
2. **Storage hardening** — documents bucket made private with signed URLs; new-format Supabase key naming documented.
3. **Restructure** — top-level nav reorganized into Projects / Business Development / Administration.
4. **Vendors & search** — dedicated Vendors nav tab, global search, folder-based Administration, Business Development enhancements.
5. **Vendor detail pages** — per-vendor pages, folder permissions, multi-board lead pipelines, customizable Project/Procurement custom fields.
6. **Board/list management** — board/list renaming, custom-field creation moved into project Edit flow, item copy-to-list.
7. **Rebrand** — product renamed from "MDI Studio" to "Design Firm Ops"; brand guidelines (colors/typography) applied app-wide.
8. **Invoicing Phase 2** — item locking, PDF generation, send flow via Resend, void, payment status automation. *(This is the fork point — everything below is on one branch or the other, not both.)*
9. *(main only)* **Local dev tooling** — cross-platform `npm run setup` script (provisions local Supabase via CLI, generates secrets, seeds data), full README rewrite, first Vitest unit tests (`pricing`, `money`, `crypto`, `StatusFilter`, `Nav`, `NavSearch`, `ConfirmDialog`), `CLAUDE.md` (dev conventions + Linear→plan→PR workflow).
10. *(status-7gc184 only, unmerged)*:
    - **Permissions system** — per-user permissions (`PermissionsManager.tsx`, `/api/users/[id]/permissions`), replacing the simpler role-based `PermissionsForm`.
    - **Fee structures** — `feeStructure.ts` lib, richer `DesignFeeSection.tsx` (+610 lines), unified design-fee billing/invoicing, restructured Invoices tab, `ProcurementFeeSection.tsx`.
    - **Document folders** — renamable project document folders (`document-folders` API + migration), `ProjectDocumentsBrowser.tsx` overhaul.
    - **Settings reorg** — Users management moved from Administration into Settings; new `SettingsForm` fields.
    - **Procurement table rework** (largest single change — `ItemsTable.tsx` +819 lines) — sticky columns, explicit item types with auto-generated tags (`itemType.ts`, `itemTag.ts`, `/api/item-types`), item grouping, dimensions/weight/bulb-qty fields, tri-state bulb-included flag with a derived "Bulbs" summary, growable room dropdown (`room.ts`), opaque sticky headers.
    - **Multi-contact clients** — clients can now have more than one contact.
    - **Voided invoices** — `VoidedInvoicesDropdown.tsx`.
    - Five new Prisma migrations: `permissions_fee_structures_invoice_types`, `project_document_folders`, `item_types_dimensions_client_contacts`, `bulb_qty_project_rooms` (plus the shared `invoicing_phase2`).

## 4. Data model (Prisma schema, `main` branch baseline)

Core entities and how they relate:

- **User** (ADMIN | DESIGNER role) — auth + permission gating.
- **Client** → has many **Project**s.
- **Project** — status (LEAD/ACTIVE/ON_HOLD/COMPLETE), fee structure (FLAT_FEE/HOURLY/COST_PLUS/HYBRID), default markup %/mode, sales tax rate/base, invoice prefix, per-project custom fields (`ProjectFieldDef`/`ProjectFieldValue` — designed as the future landing spot for AI-extracted contract data).
- **Item** — a line item within a project: category, room, vendor, offering, procurement list, qty, unit cost, platform fee, markup overrides, dimensions/finish/link, image, status (PROPOSED→APPROVED→INVOICED→ORDERED→RECEIVED→DELIVERED), optional custom fields (`ItemFieldDef`/`ItemFieldValue` — future landing spot for AI-extracted vendor PDF data).
- **ProcurementList** — user-defined sub-lists within a project's Procurement tab.
- **Vendor** — rep contact, showroom, account/product type, price range, offerings, encrypted trade-account credentials (AES-256-GCM via `src/lib/crypto.ts`).
- **Offering** — user-customizable product category shared by Vendor and Item.
- **Document** — polymorphic (belongs to Project XOR Lead, optionally tagged to one Item); private bucket, signed URLs, folder-organized.
- **Invoice** — merchandise invoices; snapshots shipping/tax at creation so history doesn't drift; `portalToken` reserved for a future client payment portal (Phase 4); configurable `columnConfig` for what the client sees.
- **Payment** — MERCHANDISE or DESIGN_FEE category; ACH/WIRE/CHECK/CREDIT_CARD/OTHER.
- **DesignFeeCharge** — separate ledger from merchandise invoices.
- **LeadBoard** → **PipelineStage** → **Lead** — up to 5 independent kanban-style sales pipelines; a Lead converts into a Client + Project when won.
- **ReferralPartner** — tracked against Leads.
- **Resource** / **ResourceFolder** — firm-wide file library (Administration), with per-folder access lists.
- **Settings** — singleton row: company info, payment instructions, invoice branding colors, and per-designer visibility toggles (financials, client contact, documents, contracts, invoices, procurement, vendor credentials).

## 5. Architecture conventions (from `CLAUDE.md`)

- **DRY**: business logic (pricing, money, invoice numbering/status, permissions, validation, financials) lives only in `src/lib/`; routes/components call it, never duplicate it. Shared UI goes in `src/components/`.
- **TDD**: write failing tests first for new/changed logic in `src/lib`, especially pricing/tax/invoice-status/money math. Vitest, two project configs — `*.test.ts` (node env, pure logic) and `*.test.tsx` (jsdom + RTL, components). Tests are co-located next to the module they cover.
- **Money rules**: never floats — always `decimal.js` / Prisma `Decimal`. Round each unit price to the cent first, then extend by qty, then sum — matches a human bookkeeper, enforced by pricing tests.
- **Auth**: everything under `/app` is gated in `src/middleware.ts`. Roles are ADMIN/DESIGNER; permission checks in `src/lib/permissions.ts` (being reworked into a per-user model on the status branch).
- **Secrets**: vendor trade-account passwords encrypted at rest (`src/lib/crypto.ts`, AES-256-GCM); never logged or returned decrypted to the client.
- **Validation**: Zod schemas in `src/lib/validation.ts` for all API input.
- **Issue workflow**: Linear issue → write `plans/<TAG>_PLAN.md` → get developer approval → do the work (TDD) → branch off `main` (or the relevant feature branch if building on unmerged work) → PR to `main` via `gh pr create`. One branch + one PR per issue. A Linear MCP server integration is referenced as "to be configured" — not yet wired up as of this writing.

## 6. Local dev / setup (main branch)

- Node 20+ (developed on 24; `.nvmrc` pins 24.18.0).
- `npm install && npm run setup` — cross-platform script that provisions a local Supabase stack via Docker + Supabase CLI, generates secrets, prompts for optional keys (Resend, Anthropic), runs migrations, and seeds demo data (2 owner/ADMIN accounts, 1 demo DESIGNER, default pipeline stages, ~65-vendor FF&E list, a demo project "Westland Reserve Red Rock Office" with 13 lighting line items and sample invoicing/payment data).
- Manual path: `cp .env.example .env` → `npm run prisma:generate` → `npm run prisma:migrate` → `npm run prisma:seed` → `npm run dev`.
- Key env vars: `DATABASE_URL`/`DIRECT_URL` (Supabase Postgres, pooled/direct), `NEXTAUTH_URL`/`NEXTAUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, `ANTHROPIC_API_KEY` (optional), `CREDENTIALS_ENCRYPTION_KEY`, `SEED_*`.
- Three Supabase Storage buckets, auto-created on first upload: `documents` (private), `resources` (private), `branding` (public).

## 7. What's explicitly NOT built yet

- **Client payment portal** — `Invoice.portalToken` field exists and send/PDF flows already generate it, but the actual portal page (Phase 4, per the schema comments) hasn't shipped.
- **AI document extraction** — `ProjectFieldDef`/`ItemFieldDef` are explicitly designed as landing spots for future Anthropic-API-driven extraction from contracts and vendor PDFs, but no extraction code exists yet; `ANTHROPIC_API_KEY` is wired into env but unused.
- **Linear MCP integration** — referenced in `CLAUDE.md` as the intended way to pull issues, marked "to be configured."
- **Branch reconciliation** (see §2) — permissions rework, fee structures, and the procurement table overhaul are sitting unmerged on `claude/mdi-studio-status-7gc184`.
- Multi-tenant / firm-agnostic SaaS layer — current schema and seed data (Settings singleton, hardcoded vendor list) are still single-firm (MDI); turning this into the multi-firm DFO SaaS product will need a tenancy model.

## 8. Suggested next steps

1. Reconcile `main` and `claude/mdi-studio-status-7gc184` into a single current branch (see §2) — this is the main source of confusion right now and should happen before any new feature work.
2. Decide on and configure the Linear MCP server referenced in `CLAUDE.md` so the documented issue workflow can actually run.
3. Scope the client payment portal (Phase 4) — the data model is ready (`portalToken`, `columnConfig`).
4. Scope multi-tenancy if/when this moves from "MDI's internal tool" toward "sellable DFO SaaS product" — current single-`Settings`-row, single-firm assumptions will need to change.
5. Scope the AI document-extraction phase — the `*FieldDef`/`*FieldValue` pattern already anticipates this.
