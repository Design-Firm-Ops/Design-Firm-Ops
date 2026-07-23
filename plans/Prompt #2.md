# MDI Studio — Phase 2 Build Prompt (Updated for actual Phase 1 build)

Paste this after your existing PROJECT CONTEXT block. This replaces the original Phase 2 section — it's been rewritten against what's actually in `Dittontr/Design-Firm-Ops` (branch `claude/mdi-studio-setup-r3c3qd`), not the original spec assumptions.

---

## WHAT'S ALREADY BUILT (read this before writing any code)

Phase 1 shipped with real deviations from the original spec. Do not re-create any of the following — extend it:

- **Auth/roles**: `User.role` is `ADMIN | DESIGNER`, not a flat 2-user system. `Settings` has per-designer visibility toggles (`designerCanViewFinancials`, `designerCanViewInvoices`, etc.), resolved via `resolvePermissions(session)` in `src/lib/permissions.ts`. All new invoice routes must gate through this, matching the pattern already used in `src/app/api/invoices/route.ts` (`perms.invoices` for invoice actions, `perms.financials` for money-sensitive ones).
- **Pricing engine**: `src/lib/pricing.ts` (decimal.js, round-per-line) and `src/lib/financials.ts` (`priceItem`, `summarizeProjectFinancials`, `summarizeDesignFee`) are done and correct. Use them — don't duplicate pricing math in new routes.
- **Invoice model is live-linked, not snapshotted**: `Item.invoiceId` is a direct FK. There is no `InvoiceLineItem` table. Invoice totals are computed on the fly from `invoice.items` via `computeInvoiceTotals`. **This phase changes item locking behavior (see below) but does NOT add a snapshot table** — that's an explicit decision, not an oversight.
- **Design fees are a separate ledger already**: `DesignFeeCharge` (billed) + `Payment{category: DESIGN_FEE}` (paid), summarized by `summarizeDesignFee()`. UI already exists in `DesignFeeSection.tsx` with its own API at `/api/design-fee-charges`. **Phase 2 below is about the `Invoice`/merchandise side only** — don't touch or duplicate the design fee flow.
- **Payment recording already exists**: `/api/payments` (POST) already creates `Payment` rows against either an invoice or the design-fee ledger, permission-gated. What's missing (build this phase): **auto-updating `Invoice.status`** (DRAFT → SENT → PARTIALLY_PAID → PAID) when payments land against it. That logic doesn't exist yet.
- **Invoice creation UI/API already exists**: `InvoicesTab.tsx` + `POST /api/invoices` (select un-invoiced items → draft invoice, live totals preview, sets `item.status = 'INVOICED'` and `item.invoiceId`). Extend this component — don't rebuild it.
- **Invoice numbering** is `{project.invoicePrefix}-{seq}` (e.g. `2506-001`), sequential per project, no merch/design split — because design fees don't invoice through this model. Keep this scheme.
- **`InvoiceStatus` enum currently has no `VOID`** — add it.
- **No `columnConfig` or `portalToken` on `Invoice` yet** — both need to be added this phase (portalToken now, even though the public portal page itself is Phase 4 — PDFs and future portal links both need it to exist).

---

## ITEM LOCKING (new this phase — confirmed approach)

Once an `Item` is attached to an invoice (`invoiceId` set), it becomes **locked**:
- `PATCH /api/items/[id]` and the inline-edit table must reject edits to a locked item by default, returning a clear error (`"This item is locked to invoice {invoiceNumber}. Unlock to edit."`).
- Add an **explicit override**: a "Correct this item" action in `ItemsTable.tsx`, gated behind `perms.invoices` (or restrict to `ADMIN` role — your call, but be consistent with how other money-sensitive overrides are gated elsewhere in the app) and a `ConfirmDialog` warning that this changes figures on an already-created invoice. The API accepts an explicit `unlockOverride: true` flag on the PATCH body to bypass the lock — no separate detach/reattach flow needed.
- Locking is independent of `Invoice.status` — an item is locked the moment it's added to a DRAFT invoice, not just once SENT. This matches current invoice-creation behavior (items flip to `INVOICED` status immediately on invoice creation).
- Removing an item from an invoice entirely (e.g., invoice was a mistake) should go through **voiding or editing the invoice itself** (see below), which detaches items and reverts their status to `APPROVED` — not a separate item-level "unlink" action.

---

## PHASE 2 SCOPE — Invoicing: PDF, send, payment status automation, void, column visibility

**Schema changes (migration on top of existing schema, not a rewrite):**
```prisma
enum InvoiceStatus {
  DRAFT
  SENT
  PARTIALLY_PAID
  PAID
  VOID   // add this
}

model Invoice {
  // ...existing fields...
  portalToken   String?  @unique  // generated on first "Send"
  columnConfig  Json?              // null = use project/firm default preset
}
```
Also add whatever minimal field you need on `Item` to represent "locked" cleanly in the UI — this can be derived (`invoiceId != null`) rather than a stored column; don't add a redundant `locked` boolean unless you have a reason to store lock state independent of `invoiceId`.

**1. Column visibility controls**
Toggle per invoice which columns the client sees: Tag, Description, Qty, Unit $ (cost), Unit $ (marked up), Extended $. Presets:
- "Show markup transparently" — cost + marked-up columns visible (like the original reference invoice)
- "Price only" — just client price + extended
- "Minimal" — description, qty, extended only

Never expose vendor name or MDI's cost when the config says not to — enforce this **server-side** in the PDF/portal renderer, not just by hiding columns in a client component. Save `columnConfig` per invoice; add a project-level default that new invoices inherit.

**2. PDF generation** (`@react-pdf/renderer`)
- Match MDI brand: letterspaced serif header (`M E R C H A N D I S E   I N V O I C E`), dark-brown (`#4a3728`) logo block, cream (`#F7F3EE`) body, gold (`#C49A5C`) accent rules.
- Invoice meta block: invoice number, issue date, due date, project address.
- Line items grouped by `room` (group heading rows), respecting `columnConfig` — render only visible columns.
- Totals block: merchandise subtotal / shipping / tax / grand total, using `computeInvoiceTotals` from `pricing.ts` — do not reimplement the math.
- Second page: payment instructions from `Settings.paymentInstructions` (rich text).
- Footer: both owners' contact lines from `Settings`.

**3. Send flow**
- On first send: generate `portalToken` if not already set, flip status `DRAFT → SENT`, set `issuedDate` if unset.
- Email via Resend, PDF attached, MDI-branded template, includes portal link (`/portal/invoice/[portalToken]` — route itself is Phase 4, but the link should already be correct and live in the email).
- Gate behind `perms.invoices`.

**4. Payment status automation**
When a `Payment{category: MERCHANDISE}` is created or edited against an invoice:
- Sum payments linked to that invoice, compare to `computeInvoiceTotals(...).grandTotal`.
- `0 < paid < total` → `PARTIALLY_PAID`; `paid >= total` → `PAID`; back down again if a payment is deleted/edited to reduce the total (don't let status get stuck at PAID after a correction).
- Don't touch `VOID` invoices — payments shouldn't be recordable against a voided invoice; reject at the API level.

**5. Void**
- New action, `perms.invoices`-gated, confirmation dialog required (destructive-adjacent per house rules even though it's a status flip, not a delete).
- On void: set `status = VOID`, detach all items (`invoiceId = null`), revert item status to `APPROVED` so they're available to re-invoice.
- Voided invoices stay visible in the project's invoice history (don't hard-delete) for audit purposes.

**6. Project overview updates**
Project overview should show total invoiced, total paid, outstanding, and per-invoice status — using `summarizeProjectFinancials` (already built), extended to exclude `VOID` invoices from the invoiced total.

---

## Acceptance test (same numbers as before, now through the full flow)

Use the seeded Westland Reserve project (13 lighting items, 15% markup). Create an invoice from all 13 items with $2,295.48 shipping and 7% tax on merchandise only. Confirm:
- Draft preview and generated PDF both show merchandise subtotal **$19,287.85**, shipping **$2,295.48**, tax **$1,350.15**, grand total **$22,933.48**.
- Items are locked (edit attempt without override fails with a clear message; edit attempt with override succeeds and updates figures).
- Recording a partial payment flips status to `PARTIALLY_PAID`; recording the remainder flips it to `PAID`.
- Voiding a DRAFT/SENT invoice detaches its items back to `APPROVED` and doesn't appear in `invoicedTotal`.
