# Phase 3 — Multi-tenancy & Super-Admin Dashboard

_Plan for turning Design Firm Ops from a single-firm internal tool into a multi-tenant
SaaS with a platform-level admin console that a `SUPER_ADMIN` uses to manage every firm
on the platform. Companion to [HIGH_LEVEL_PLAN.md](HIGH_LEVEL_PLAN.md)._

---

## 1. Goal

One deployment of Design Firm Ops serves many independent interior-design firms. Each
firm's users, clients, projects, vendors, invoices, and settings are fully isolated from
every other firm's. A small number of **platform operators** (Anthropic-side / DFO-side
staff, role `SUPER_ADMIN`) get a separate console to:

- see every firm and platform-wide metrics,
- provision (onboard) a new firm and its first admin,
- suspend / reactivate / cancel a firm,
- inspect a single firm's usage and users for support,
- (optionally) impersonate a firm user for troubleshooting,
- review an audit trail of their own privileged actions.

**Firm users never see any of this.** The existing `/app` experience is unchanged for
them except that it now operates within their firm's tenant boundary.

---

## 2. Why this is a big phase (current state)

The app is **single-tenant to the core** today. Confirmed against the code:

- **No tenant entity.** There is no `Firm` / `Organization` / `Tenant` model. Nothing in
  `prisma/schema.prisma` carries a `firmId`.
- **`Settings` is a hardcoded singleton** — `model Settings { id Int @id @default(1) }`
  (schema line 617), read everywhere as `prisma.settings.findUnique({ where: { id: 1 } })`
  (e.g. `src/lib/permissions.ts` `resolvePermissions`).
- **Roles are firm-internal only** — `enum UserRole { ADMIN DESIGNER }` (schema line 16).
  There is no platform-operator role.
- **Global unique constraints assume one firm** — `User.email @unique`,
  `Offering.name @unique`, `ProjectType.name @unique`, `ResourceFolder.name @unique`,
  `Invoice.invoiceNumber @unique`, plus the singleton `Settings`. In a multi-firm world
  most of these must become **unique _per firm_**, not globally.
- **No tenant scoping in data access** — a single shared `PrismaClient`
  (`src/lib/prisma.ts`); queries are not filtered by tenant because there is no tenant.
- **Auth carries no firm context** — `src/middleware.ts` only gates `/app`; the session
  has `role` but no `firmId`.

So Phase 7 is **foundation-first**: the tenancy model and isolation must land and be
proven before the dashboard UI is worth building. The dashboard is the smaller, later
half of the work.

---

## 3. Target architecture

### 3.1 Tenant model

Add a `Firm` model (the tenant root):

```prisma
model Firm {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique          // subdomain / URL-safe handle
  status    FirmStatus @default(TRIAL)  // TRIAL | ACTIVE | SUSPENDED | CANCELED
  plan      String?                     // free-form tier for now (BASIC/PRO/…)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  // relations: users, clients, projects, vendors, settings, etc. (all back-refs)
}

enum FirmStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELED
}
```

### 3.2 Tenant scoping on every owned entity

Add `firmId String` + a `firm Firm @relation(...)` and `@@index([firmId])` to every
**tenant-owned root** entity. Child rows inherit their tenant through their parent, so
scope at the aggregate roots and rely on FKs below them:

- Direct `firmId`: `User`, `Client`, `Project`, `Vendor`, `Offering`, `ProjectType`,
  `ResourceFolder`, `Resource`, `LeadBoard`, `ReferralPartner`, `Settings`.
- Inherited (no direct column needed, reached via parent): `Item`, `ProcurementList`,
  `Invoice`, `Payment`, `DesignFeeCharge`, `Document`, `ProjectFieldDef/Value`,
  `ItemFieldDef/Value`, `PipelineStage`, `Lead`. _(Decision point — see §6: some of these
  may still want a denormalized `firmId` for cheap isolation checks and simpler queries.)_

Convert the global uniques to **composite per-firm uniques**:

- `User.email` → `@@unique([firmId, email])` (a person could exist at two firms).
  _Alternatively keep email globally unique if we want one login across firms — decide in §6._
- `Offering.name`, `ProjectType.name`, `ResourceFolder.name` → `@@unique([firmId, name])`.
- `Invoice.invoiceNumber` → `@@unique([firmId, invoiceNumber])`.
- `Settings` → drop the `id Int @default(1)` singleton; make it `firmId String @unique`
  (one settings row per firm).
- `portalToken` / signer tokens stay **globally** unique (they're random secrets, not
  per-firm names).

### 3.3 Roles & auth

- Extend `enum UserRole { ADMIN DESIGNER SUPER_ADMIN }`. `SUPER_ADMIN` is a **platform**
  operator, not a firm member — they have `firmId = null`. ADMIN/DESIGNER semantics inside
  a firm are unchanged.
- **There is exactly one `SUPER_ADMIN`, seeded at deploy time — not self-serve.** The seed
  script (`prisma/seed.ts`) upserts it idempotently by email from env vars, matching the
  existing `SEED_*` owner/designer pattern:
  - `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD` (add to `.env.example`;
    password bcrypt-hashed, never committed).
  - Created with `role: SUPER_ADMIN`, `firmId: null`. Idempotent `upsert` so re-running the
    seed (or a deploy) never duplicates it and rotates the password from env.
  - No UI ever creates a `SUPER_ADMIN`; the `/admin` console cannot mint another one.
- **Session carries `firmId`.** Extend the NextAuth JWT/session callbacks
  (`src/lib/auth.ts`, `src/types/next-auth.d.ts`) so every authenticated request knows its
  tenant. `SUPER_ADMIN` sessions have no `firmId`.
- **Tenant isolation is enforced server-side, centrally.** Introduce a helper —
  `getTenantContext(session)` returning `{ firmId, role }` — and a scoped data-access
  convention so no route can read another firm's rows. Two viable approaches (pick in §6):
  1. **Explicit scoping**: every query includes `where: { firmId }`, enforced by a thin
     repository layer + lint/review discipline.
  2. **Prisma client extension / middleware** that auto-injects `firmId` on reads/writes
     for tenant models. Safer against human error; more machinery. **Recommended.**
- `src/lib/permissions.ts` `resolvePermissions` must load **the current firm's** Settings
  (`where: { firmId }`) instead of `id: 1`.

### 3.4 Routing & the admin console

- `SUPER_ADMIN` gets a new area at **`/admin`**, entirely separate from firm-facing
  `/app`. Extend `src/middleware.ts` matcher to `['/app/:path*', '/admin/:path*']` and
  reject non-`SUPER_ADMIN` sessions from `/admin` (and, conversely, keep `SUPER_ADMIN`
  out of firm `/app` data unless impersonating).
- Firm resolution for `/app`: derive the tenant from the logged-in user's `firmId`
  (subdomain-based routing is a possible later refinement — out of scope for v1).

---

## 4. Workstreams (→ Linear issues)

Ordered; each maps to a Phase 7 issue. Earlier ones block later ones.

1. **Tenancy data model + migration + backfill.** Add `Firm` + `FirmStatus`; add `firmId`
   to the root entities in §3.2; convert global uniques to per-firm; de-singleton
   `Settings`. Write a data migration that creates one `Firm` ("Madison Ditton Interiors")
   and backfills every existing row's `firmId` to it, so current data keeps working.
   Update the seed script to create firms explicitly. **Highest-risk, foundational.**

2. **`SUPER_ADMIN` role + tenant-scoped auth/session.** Add the enum value; thread
   `firmId` through NextAuth JWT/session; add `getTenantContext`; gate `/admin` in
   middleware. No behavior change for firm users yet.

3. **Central tenant isolation in data access.** Implement the chosen scoping mechanism
   (§3.3 — recommended: Prisma client extension) and route all tenant queries through it.
   Update `resolvePermissions` to be firm-scoped. **Security-critical.**

4. **`/admin` shell + firms list.** SUPER_ADMIN-only layout/nav; table of all firms with
   status, plan, user count, project count, created date, last activity. Search/filter.

5. **Firm lifecycle management.** Firm detail page: view users & usage; **suspend /
   reactivate / cancel** a firm (confirmation dialogs per house rules). Suspension blocks
   that firm's users from logging in with a clear message; canceled is retained for audit,
   not hard-deleted.

6. **Firm provisioning (onboarding).** "Create firm" flow: create `Firm`, seed its default
   `Settings` + baseline lookups (offerings, pipeline stages), create the firm's first
   `ADMIN` user, and email them an invite / set-password link (reuse `src/lib/email.ts`).

7. **Platform metrics dashboard.** Aggregate KPIs across all firms: total/active/trial/
   suspended firms, total users, total revenue invoiced (excluding VOID), signups over
   time. Money via decimal.js; reuse `src/lib/financials.ts` aggregation where possible.

8. **Super-admin audit log (+ optional impersonation).** Record every privileged action
   (firm created/suspended/canceled, user invited, impersonation start/stop) with actor,
   target, timestamp. Optional: "log in as" a firm user for support — time-boxed,
   loudly-banner'd, and fully audit-logged.

9. **Tenant-isolation test suite.** The correctness gate for the whole phase: assert that
   a user in Firm A can never read/write Firm B's rows through any route, that
   per-firm uniques behave (two firms can both have an "LT-1" / invoice `2506-001` /
   offering "Lighting"), and that `SUPER_ADMIN` scoping/impersonation is enforced.
   Extend the Vitest suite; extract pure isolation checks into `src/lib` so they're unit-
   testable.

---

## 5. Security & correctness considerations

- **Tenant isolation is the #1 risk.** A single missing `firmId` filter leaks one firm's
  financials to another. Prefer the centralized/auto-injected scoping (§3.3) over relying
  on every author to remember a `where` clause. Back it with the isolation test suite (#9)
  as a hard gate.
- **The backfill migration is destructive-adjacent.** It rewrites every table. Test it on
  a copy; make it idempotent; keep the "everything belongs to Firm 1" assumption explicit.
- **Money rules unchanged.** Per-firm doesn't change the decimal.js / round-per-line rules;
  the reference invoice ($22,933.48) must still reconcile for Firm 1 after the migration.
- **Suspension vs. deletion.** Suspend/cancel are status flips (reversible, audit-safe);
  never hard-delete a firm's data from the console.
- **Impersonation** (if built) must be unmistakable in the UI, time-limited, and logged on
  both start and stop — it's a support tool, not a backdoor.
- **`SUPER_ADMIN` blast radius.** Keep the role rare; every `/admin` mutation is
  audit-logged; consider requiring re-auth for destructive firm actions.

---

## 6. Open questions (resolve before starting #1)

1. **One login across firms, or one account per firm?** Determines whether `User.email`
   stays globally unique or becomes `@@unique([firmId, email])`. (Recommendation: per-firm
   accounts for v1 — simplest isolation; revisit if multi-firm users become a real need.)
2. **Denormalize `firmId` onto child tables** (Item, Invoice, Payment, …) for cheaper
   isolation checks, or always join through the parent? (Recommendation: denormalize the
   high-traffic ones — Item, Invoice, Payment — for simpler `where` and defense-in-depth.)
3. **Scoping mechanism:** Prisma client extension (auto-inject) vs. explicit repository
   layer? (Recommendation: client extension.)
4. **Billing/plans scope for v1:** just a free-form `plan` string + status, or real plan
   tiers with limits (and a Stripe stub like the Phase 4 `PaymentProvider`)? (Recommendation:
   string + status now; defer real billing.)
5. **Firm routing:** derive tenant from the user's `firmId` only, or add subdomain-based
   routing (`acme.designfirmops.com`)? (Recommendation: `firmId` from session for v1.)
6. ~~Where does `SUPER_ADMIN` live~~ — **Decided:** exactly one `SUPER_ADMIN`, `firmId =
   null`, seeded at deploy time from `SEED_SUPER_ADMIN_*` env vars (see §3.3). Not
   self-serve; no UI creates one.

---

## 7. Sequencing summary

```
#1 tenancy model + migration ─┬─▶ #3 isolation enforcement ─▶ #9 isolation tests (gate)
                              │
#2 SUPER_ADMIN + auth ────────┴─▶ #4 /admin shell + firms list ─▶ #5 lifecycle
                                                                └▶ #6 provisioning
                                                                └▶ #7 metrics
                                                                └▶ #8 audit log / impersonation
```

Do **not** start the dashboard UI (#4+) before the tenancy foundation (#1–#3) is merged
and the isolation tests (#9) are green — the console is only safe to build on top of a
proven tenant boundary.
