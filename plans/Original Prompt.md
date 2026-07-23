# MDI Studio — Claude Code Build Prompt

Paste the section for one phase at a time into Claude Code. Start every session by pasting the **Project Context** block, then the phase you're building.

---

## PROJECT CONTEXT (paste at the start of every session)

You are building "MDI Studio," an internal project management, procurement, and invoicing platform for Madison Ditton Interiors (MDI), a luxury interior design firm in Utah. Two internal users (owners). Clients never create accounts — all client interactions happen through secure tokenized links.

**Stack (do not deviate):**
- Next.js 14 (App Router) + TypeScript
- Prisma ORM + Postgres (Supabase)
- Supabase Storage for file uploads (contracts, presentations, vendor invoices)
- Tailwind CSS
- Resend for transactional email
- PDF generation via `@react-pdf/renderer` (invoices, signed contracts)
- Auth for internal users only: simple email/password via NextAuth (2 users), all `/app` routes protected; all `/portal` routes are public but token-gated
- Anthropic API (`claude-sonnet-4-6`) for document extraction (Phase 5)

**Brand (use throughout, including PDFs):**
- Primary dark brown `#4a3728`, cream `#F7F3EE`, gold accent `#C49A5C`, taupe `#BCA88A`
- Serif: Lora (headings, invoice titles). Sans: Poppins Light (body)
- Invoice header style: letterspaced serif title (e.g., "M E R C H A N D I S E   I N V O I C E"), MDI logo block on dark brown

**Pricing logic (this is the core of the business — get it exactly right, use Decimal types, never floats):**
- Each line item has: `unitCost` (what MDI pays the vendor), optional `platformFee` (per-unit fee added for certain sourcing platforms; defaults to 0), and a markup applied on top.
- Markup can be expressed as **markup %** (price = cost × (1 + m)) or **margin %** (price = cost / (1 − m)). Store which mode is used. Default: 15% markup, configurable per project, overridable per line item.
- `clientUnitPrice = (unitCost + platformFee) × (1 + markup)` (or margin formula)
- `extendedPrice = clientUnitPrice × qty`
- Invoice totals: merchandise subtotal (sum of extended) + estimated shipping/freight (manual entry, per vendor or lump) + sales tax (rate configurable per project, e.g., 7% or 7.25%, applied to merchandise subtotal + shipping per Utah rules — make the tax base configurable: merch only vs merch + shipping) = grand total.
- Round each unit price to 2 decimals, then extend, then sum — match this reference: 13 items, subtotal $19,287.85, shipping $2,295.48, 7% tax $1,350.15, grand total $22,933.48.

**General rules:**
- Every destructive action gets a confirmation dialog.
- All money displayed as `$1,234.56`.
- Seed script with sample data: 1 client, 1 project ("Westland Reserve Red Rock Office"), 13 lighting line items matching the reference above.
- Write clean, commented code. Mobile-responsive. No placeholder "TODO" features — if a phase says build it, build it working end to end.

---

## PHASE 1 — Data model, auth, projects, and items

Build the foundation:

**Prisma schema:**
- `User` (internal): email, passwordHash, name
- `Client`: name, email, phone, billingAddress, notes
- `Project`: client (FK), name, projectAddress, status (LEAD / ACTIVE / ON_HOLD / COMPLETE), startDate, feeStructure (enum: FLAT_FEE / HOURLY / COST_PLUS / HYBRID), feeNotes (text), defaultMarkupPct, markupMode (MARKUP / MARGIN), salesTaxRate, taxBase (MERCH_ONLY / MERCH_PLUS_SHIPPING), invoicePrefix (e.g., "2506")
- `Vendor`: name, website, accountNumber, repName, repEmail, repPhone, notes
- `Item` (merchandise line): project (FK), tag (e.g., "LT-1"), name, invoiceDisplayName (optional override shown to client), category (enum: LIGHTING / FURNITURE / PLUMBING / HARDWARE / TEXTILES / ART / ACCESSORIES / APPLIANCES / OTHER), room (free text, e.g., "Conference Room"), vendor (FK, optional), qty, unitCost (Decimal), platformFee (Decimal, default 0), markupPct (nullable — falls back to project default), markupMode (nullable — falls back to project), dimensions, finish, link (URL), shippingNotes, status (PROPOSED / APPROVED / INVOICED / ORDERED / RECEIVED / DELIVERED), sourceDocument (FK to Document, nullable — set when item came from an uploaded doc)
- `Document`: project (FK), type (PRESENTATION / VENDOR_INVOICE / CONTRACT / OTHER), filename, storageUrl, uploadedAt
- `Settings` (singleton): company name, address, contact lines for both owners, payment instructions rich text (ACH, wire, Chase Bill Pay — rendered on invoice PDFs), logo

Computed (not stored): clientUnitPrice, extendedPrice, extendedCost, profit per item and per project.

**Pages:**
- `/app/dashboard`: projects list with status, client, start date, invoiced total, paid total, outstanding
- `/app/projects/[id]`: project overview — fee structure, dates, tabs for Items / Invoices / Contracts / Documents / Payments
- Items tab: spreadsheet-style editable table (tag, name, category, room, vendor, qty, unit cost, markup, computed client price, extended, status). Inline editing, add row, bulk-select rows. Column showing profit per line visible to internal users only. Totals footer.
- `/app/vendors` and `/app/clients`: simple CRUD
- `/app/settings`: company settings incl. payment instructions editor

Seed the Westland Reserve data and verify the totals match the reference numbers.

---

## PHASE 2 — Invoicing

**Schema additions:**
- `Invoice`: project (FK), invoiceNumber (auto: `{project.invoicePrefix}-M{n}` for merchandise, `-D{n}` for design fees — user can override), issueDate, dueDate, status (DRAFT / SENT / PARTIALLY_PAID / PAID / VOID), invoiceType (MERCHANDISE / DESIGN_FEE / OTHER), shippingAmount (Decimal), taxRate snapshot, notes, portalToken (unique, random 32+ chars), **columnConfig JSON** (see below), lineItems (relation)
- `InvoiceLineItem`: invoice (FK), item (FK, nullable — design-fee lines have no item), snapshot fields copied at invoice creation (tag, displayName, qty, unitCost, platformFee, markupPct, clientUnitPrice, extendedPrice, room/group heading). Snapshots are frozen — editing the Item later must NOT change an issued invoice.
- `Payment`: invoice (FK), amount, method (CHECK / ACH / WIRE / CHASE_BILLPAY / CARD / OTHER), date, reference, notes, recordedBy

**Invoice builder flow:**
1. From a project's Items tab, select rows → "Create Invoice." Also allow blank invoice with manual lines (for design fees).
2. Builder screen: reorder lines, group by room/category with group heading rows (like "New Primary Bedroom Bedding" in the reference), edit shipping, tax rate, due date, notes.
3. **Column visibility controls — this is a key feature.** Toggle per invoice which columns the client sees: Tag, Description, Qty, Unit $, Unit $ + markup, Extended $. Presets: "Show markup transparently" (cost + marked-up columns, like the reference invoice), "Price only" (just client price + extended), "Minimal" (description, qty, extended). Never expose vendor names or MDI's cost when hidden. Save config per invoice; set project-level default.
4. PDF generation matching MDI brand: letterspaced serif header, invoice meta block (date, #, project address), grouped line-item table with only the visible columns, subtotal / estimated shipping / sales tax / grand total block, payment-methods note, second page with payment instructions from Settings, footer with both owners' contact lines.
5. Actions: download PDF, send via email (Resend, PDF attached + portal link), record payment (updates status automatically: partial → PARTIALLY_PAID, full → PAID), void.
6. Marking items invoiced sets their status to INVOICED.

Project overview should now show: total invoiced, total paid, outstanding, and per-invoice status list.

---

## PHASE 3 — Contracts & e-signature (no client login)

**Schema:**
- `Contract`: project (FK), title, sourceFile (uploaded PDF or generated from template), status (DRAFT / SENT / VIEWED / SIGNED / DECLINED / VOIDED), signers (relation), signedPdfUrl
- `Signer`: contract (FK), name, email, order, token (unique random), status, signatureImage or typedSignature, consentAcceptedAt, signedAt, ipAddress, userAgent
- `ContractEvent` (audit log): contract, type (CREATED / SENT / VIEWED / SIGNED / DECLINED / REMINDER_SENT), timestamp, ip, meta JSON

**Flow:**
1. Internal user uploads a contract PDF (or pastes text into a simple rich-text template with merge fields: client name, project name, fee structure, date), adds one or more signers, clicks Send.
2. Each signer gets an email with a unique link `/portal/sign/[token]`. **No login.** Token expires in 30 days; resend regenerates.
3. Signing page: renders the PDF inline, requires scrolling through, ESIGN consent checkbox ("I agree to conduct this transaction electronically and adopt this as my legal signature"), signature input (draw on canvas OR type name rendered in a script font — signer's choice), Sign button.
4. On sign: record timestamp, IP, user agent; generate final PDF = original + appended signature page + audit certificate page (all events, signer identities, IPs, timestamps, document SHA-256 hash). Email the completed PDF to signer and both MDI owners. Store in Supabase Storage.
5. Internal contract view: status timeline, audit log, download signed copy, send reminder.

---

## PHASE 4 — Client payment portal

- `/portal/invoice/[portalToken]` — public, token-gated, no login. Shows the branded invoice exactly as the PDF (respecting column visibility config), status badge, amount due, payment history.
- "Pay Now" section built on a **PaymentProvider interface**: `createCheckout(invoice, amount)`, `handleWebhook(payload)`, `getStatus(ref)`.
  - Implement `ManualPaymentProvider` now: shows ACH / wire / check / Chase Bill Pay instructions from Settings, plus a "Notify MDI I've sent payment" button that emails the owners and logs a pending payment for internal confirmation.
  - Stub `PlutosPaymentsProvider` implementing the same interface with clearly marked TODO integration points (API key config, checkout redirect, webhook handler at `/api/webhooks/plutos`). The portal UI must not change when this is activated — only the provider swaps via an env var `PAYMENT_PROVIDER=manual|plutos`.
- Support partial payments and a configurable deposit request (e.g., "50% due to proceed").
- Also add `/portal/project/[token]`: optional read-only client project page — accessible contract(s), invoices with statuses, paid/pending amounts, shared documents (only ones explicitly marked "share with client"). Add a `clientShared` boolean on Document and Invoice.

---

## PHASE 5 — AI document ingestion (vendor invoices & client presentations)

Goal: upload a vendor invoice (PDF/image) or a client presentation (PDF) and auto-populate Items.

1. Upload UI on the project Documents tab with type selector: Vendor Invoice or Client Presentation.
2. Server route sends the file to the Anthropic API (model `claude-sonnet-4-6`) as a document/image input with a strict extraction prompt returning JSON only:
   - For **vendor invoices**: vendor name, invoice number, date, and line items — item name, qty, unit cost, extended cost, shipping if present.
   - For **client presentations** (like MDI's lighting deck: each page has a room label, price like "$966 x2", dimensions, finish): item name/room from the page label, unit price, qty parsed from "xN", dimensions, finish. Treat the presentation price as **unitCost** (pre-markup) by default, with a toggle at review time for "prices already include markup."
3. **Review screen (mandatory — never auto-commit):** parsed rows in an editable table with per-row confidence, side-by-side with the source page image. User fixes anything, maps vendor to an existing Vendor record (or creates one), assigns category, then clicks "Add N items to project."
4. Committed items get `sourceDocument` set. For vendor invoices, also record actual costs against existing items when names match (fuzzy match suggestion UI: "LT-9 Flint Multi Light Pendant — match to invoice line 'Flint 5-Light Pendant'? cost $1,946.89").
5. Handle multi-page PDFs (send pages in batches), and fail gracefully with a "manual entry" fallback.

Env var: `ANTHROPIC_API_KEY`.

---

## PHASE 6 — Polish & reporting

- Dashboard KPIs: outstanding receivables, revenue invoiced YTD, profit by project (client price vs cost), items awaiting order/delivery.
- Project P&L view: total client price vs total cost vs realized markup per category.
- Global search (projects, items, invoices, clients).
- Email templates (Resend) branded in MDI colors for: invoice sent, payment received, contract sent, contract signed, payment reminder (manual trigger + optional auto-reminder at N days past due).
- Activity log per project.
- Export any item table or invoice to XLSX.
- Basic backup: nightly Postgres dump instructions in README; document all env vars and deployment steps (Vercel + Supabase) in README.

---

## Acceptance test (run after Phase 2)

Enter these 13 items with 15% markup, $2,295.48 shipping, 7% tax on merchandise subtotal only:

| Tag | Item | Qty | Unit Cost |
|---|---|---|---|
| LT-1 | Rise and Shine Pendant | 4 | 725.02 |
| LT-2 | Collier Semi Flush Ceiling Light | 1 | 344.83 |
| LT-3 | Regent Wall Sconce | 3 | 165.23 |
| LT-4 | Astrid Picture Light | 4 | 308.36 |
| LT-5 | Quarry Wall Sconce | 3 | 154.39 |
| LT-6 | Stiched Pendant (Middle Bulb) | 2 | 426.94 |
| LT-7 | Stiched Pendant (End Bulb) | 1 | 426.94 |
| LT-8 | Caesar Bathroom Vanity Light | 2 | 308.36 |
| LT-9 | Flint Multi Light Pendant | 1 | 1946.89 |
| LT-10 | Madame Double Pendant | 3 | 1410.82 |
| LT-11 | Madame Wall Sconce | 2 | 831.83 |
| LT-12 | Odin Bathroom Vanity Light | 2 | 408.95 |
| LT-13 | Cumulus Wall Sconce/Ceiling Flush Light | 1 | 776.38 |

Expected: merchandise subtotal **$19,287.85**, shipping **$2,295.48**, tax **$1,350.15**, grand total **$22,933.48**. If it doesn't match, fix rounding (round unit price to 2 decimals before extending).
