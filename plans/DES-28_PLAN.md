# DES-28 — Firm provisioning: public sign-up

**Linear:** [DES-28](https://linear.app/design-firm-ops/issue/DES-28/firm-provisioning-onboarding-flow) · milestone _Phase 3_ · **High**
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §4.6 · builds on DES-27 (PR #14, open)

**Scope change from the original plan:** provisioning is *self-serve*, not operator-driven.
Anyone can register, and registering creates a Firm plus its first ADMIN user. Billing is
a separate concern, so this ships a **mock** billing step offering monthly or yearly (at a
discount).

> **Acceptance criterion:** a newly provisioned firm can log in and reaches a working,
> isolated `/app` with sane defaults.

## The finding that shapes this issue

"Sane defaults" sounds like the easy half. It isn't, because **those defaults don't exist
as code anywhere.**

Every baseline lookup a firm needs was inserted by a *migration* — one-time SQL against
the single firm that existed at the time:

| Default | Where it lives today |
|---|---|
| 8 offerings (Furniture, Outdoor, Rugs…) | `20260720190000_customizable_taxonomies/migration.sql` |
| 5 fee-structure options | `20260721190000_permissions…/migration.sql` |
| 13 item-type options | `20260723090000_item_types…/migration.sql` |
| "Leads" board | `20260720190000_customizable_taxonomies/migration.sql` |
| 5 pipeline stages | `prisma/seed.ts`, hardcoded for the demo firm |
| `Settings` row | `prisma/seed.ts`, with Madison Ditton's real address in it |

A firm created at runtime today therefore gets **none of them**. It would land in an `/app`
with no offerings, no fee structures, no pipeline, and no `Settings` row — which
`resolvePermissions` reads on every request.

So the centre of this issue is: **provisioning becomes a first-class, tested function**,
and it becomes the single source of truth for what a new firm gets. `prisma/seed.ts` then
calls it too, so the demo tenant and a real sign-up can't drift apart — the DRY rule the
repo already holds itself to, applied to the one thing that had escaped into SQL.

## Shape

### `src/server/provisionFirm.ts`

One transaction, or nothing:

```
Firm (TRIAL, chosen plan)
  └─ Settings          — empty but present, seeded with the firm's own name
  └─ Offerings         ×8
  └─ FeeStructureOption×5
  └─ ItemTypeOption    ×13
  └─ LeadBoard "Leads"
       └─ PipelineStage ×5
  └─ User (ADMIN, bcrypt hash)
```

Half a firm is worse than none: a Firm with no Settings, or a User with no Firm, is a
broken tenant someone has to clean up by hand. The transaction is the point.

The default *data* moves to `src/server/firmDefaults.ts` — plain arrays lifted out of the
migration SQL, so "what does a new firm get" is one readable list rather than an
archaeology exercise.

### Slug uniqueness

`Firm.slug` is globally unique. Two firms called "Harbor Design" must both work, so
slugging is a pure function plus a collision suffix (`harbor-design`, `harbor-design-2`),
tested — the same shape as `generateUniquePrefix` for item tags. A race between two
simultaneous sign-ups is handled by retrying on the unique violation rather than by
checking first and hoping.

### `POST /api/signup` — the first unauthenticated write endpoint

Everything in the app today is behind the middleware gate or a tokenized portal link. This
is new attack surface, and it collides (a third time) with the structural guard *"every
API route goes through a guarded client"*.

The widening has to stay honest. The invariant is **no route reaches the database except
through a named, guarded door** — and sign-up's door is `provisionFirm`, whose guarantee
is that it creates exactly one firm and stamps everything to it. So the guard gains a
third arm: `/api/signup` must use `provisionFirm` and nothing else that touches the
database. A route reaching the DB any other way still fails, wherever it lives.

I'll probe-test that by adding a sign-up route that queries directly and confirming it
fails.

### Pages

- `/signup` — firm name, your name, email, password, plan (monthly / yearly).
- `/signup/billing` — the mock. Clearly labelled as a placeholder, not a fake card form.
- Both public: `middleware.ts` matches only `/app` and `/admin`, so no change needed —
  but a test should pin that, because it's the kind of thing a later matcher edit breaks
  silently.

New firms start `TRIAL`, which is what that status was for and what DES-27 already
handles.

## Test strategy (TDD — tests first)

| Layer | File | What it pins |
|---|---|---|
| Pure | `src/lib/slug.test.ts` | slugify: casing, punctuation, unicode, empty/edge names; collision suffixes |
| Pure | `src/lib/validation.test.ts` | the sign-up schema — password length, email shape, plan enum, required firm name |
| Server | `src/server/provisionFirm.test.ts` | creates every default; is one transaction; rejects a duplicate email; retries a slug collision |
| Server | `src/server/firmDefaults.test.ts` | the lists match what the migrations gave the existing firm — otherwise new firms silently differ from the old one |
| Component | `src/app/signup/SignupForm.test.tsx` | validation surfaces; duplicate email is reported; success navigates |
| Structural | `isolationGuards.test.ts` | sign-up goes through `provisionFirm`; the widened rule still catches a direct query |
| Integration | `tenant.isolation.test.ts` | **the acceptance criterion**: provision two firms, each sees only its own defaults; neither can read the other's |

That last row is the one that actually answers the acceptance criterion. "Reaches a
working, isolated `/app`" is a claim about isolation, and this repo has a real two-firm
harness to prove it in rather than assert it.

## Risks

- **A public endpoint that creates tenants.** Unlimited firms from a script is the obvious
  abuse. See the questions below.
- **Defaults drifting from the migrations.** If `firmDefaults.ts` disagrees with what the
  original firm got, new tenants quietly differ from the old one — pinned by a test that
  compares the two.
- **Guard widening, third time.** Each widening is a chance to turn a real check into a
  rubber stamp; probe-tested as above.
- **Email enumeration.** Sign-up must tell you an address is already registered, or the
  form is unusable — unlike the login gate, where DES-27 was careful to avoid exactly
  this. Worth stating that the trade-off is deliberate rather than overlooked.

## Decisions _(2026-07-27)_

- **Abuse:** a per-IP rate limit on `POST /api/signup` — 5 per hour, in-memory, `429` with
  a retry hint. Stated honestly in the code: it is per-process, so it slows a script
  rather than stopping a determined one. No email verification, so the acceptance
  criterion ("can log in and reaches a working `/app`") holds without a detour.
- **Billing:** the plan is chosen on the sign-up form and stored on `Firm.plan`; the firm
  is created immediately and the mock billing page is a confirmation *after*. No step can
  strand a half-made account, and skipping the mock still leaves a working firm.
- **Seed:** `prisma/seed.ts` calls `provisionFirm`, so the demo tenant and a real sign-up
  cannot drift. The seed keeps its extra demo data (vendors, sample project) layered on
  top. This is the DRY payoff of the issue.

**Base branch:** DES-27 (PR #14) should merge first and this branches off `main` — the same
approach as last time. The two don't conflict functionally, but both edit
`isolationGuards.test.ts` and `apiAuth.ts`, so stacking would make the diff hard to read.

## Out of scope

- Real billing, payment details, plan enforcement — the page is explicitly a mock, and
  entering card details is not something this flow will do.
- Inviting further users into a firm — the sign-up creates the first ADMIN only.
- Platform metrics (DES-29) and the audit-log UI (DES-30).

---

## What shipped

**650 tests** (was 589), 55 in the isolation suite. Lint, tsc, coverage gate and build
clean; `/signup`, `/signup/billing` and `/api/signup` all appear in the build.

### The defaults now exist as code

`src/server/firmDefaults.ts` holds the lists that were trapped in migration SQL, and
`firmDefaults.test.ts` **reads the migration files** and compares — restating the lists
would only have proved I can copy twice.

That test earned its keep on the first run: it caught that design-fee "Cost Plus" was
inserted by an `INSERT…SELECT` guarded on `WHERE EXISTS (… feeStructure = 'COST_PLUS')`.
It was a *backfill for firms already using it*, not a default. It's deliberately absent
now, with the asymmetry explained where someone would otherwise "fix" it.

### `applyFirmDefaults`, not just `provisionFirm`

The plan said the seed would call `provisionFirm`. Implementing it turned up a wrinkle:
the multi-tenancy migration **always** inserts the `madison-ditton-interiors` firm, on
every database including a fresh one — so a seed that provisioned "when absent" would
never actually run that path.

So the defaults were extracted one level down into `applyFirmDefaults`, which is
idempotent (count-guarded, never overwriting a firm's own edits). `provisionFirm` calls it
inside its transaction; the seed calls it for the demo firm. Both get their defaults from
one definition regardless of how the firm was born — which is what the decision was
actually for. `seedPipelineStages` was deleted; it's now that function's job.

### Guards: a third door, and a gap probing found

The invariant is stated once in the test now: **no route reaches the database except
through a named door that carries its own guarantee.** Three doors — tenant client,
platform client, and `provisionFirm` for the route that *creates* a tenant.

One planned widening turned out to be unnecessary. Giving `provisionFirm` a defaulted
client (`db = prisma`, matching `firmDenialFor`) meant `/api/signup` never imports raw
prisma, so the "no route imports the raw prisma client" guard stayed **untouched**.

| Breach | Result |
|---|---|
| Sign-up queries the database directly | 2 guards fail |
| A new API route using no guarded door | widened guard fails |
| A default drifts from the migrations | `firmDefaults` test fails |
| **Rate limit deleted from sign-up** | **passed — nothing caught it** |

That last row was a real hole: every other property of the route was pinned and the
limiter could be removed silently. A guard was added and the breach re-run to confirm it
now fails.

### Verified end to end

Against a fresh migrated database, over HTTP:

| Request | Result |
|---|---|
| Sign up | **201** `harbor-pine-design-co` |
| Same firm name again | **201** `harbor-pine-design-co-2` |
| Duplicate email | **409** |
| Password too short / bad plan / empty name | **400** each |
| 6th sign-up from one IP | **429**, `Retry-After: 3600` |

Both firms got exactly `8 offerings · 5 fee structures · 13 item types · 5 pipeline stages
· 1 settings · 1 ADMIN`, status `TRIAL`, correct plan, distinct slugs.

Then the acceptance criterion itself, as the new firm's admin: `/app/projects`,
`/app/business-development`, `/app/vendors`, `/app/settings` and `/app/administration` all
**200 with no error page**, the firm's own fee options and lead pipeline rendering in
them, and the mock billing page showing the plan read back from the firm — `Yearly plan ·
$490.00 · Saving $98.00 a year · Billing isn't connected yet`.

### Two notes

- **Email enumeration is a deliberate reversal.** DES-27 took care to avoid revealing
  which addresses exist; sign-up has to say an address is taken or the form is unusable.
  Stated at the call site so it reads as a trade-off rather than an oversight.
- **The rate limiter is honest about itself.** In-memory and per-process: it slows a
  casual script, and is not a WAF. Written in the module comment so nobody trusts it for
  more than it does.

---

## Addition: the public home page

Requested during the PR. `/` was a redirect — signed in to your landing page, signed out
to `/login` — so a stranger who hadn't heard of this met a login form with no way to
register and nothing explaining what it was.

`/` is now the front door: hero, what the app does, pricing, and both ways in. A signed-in
visitor still never sees it, and is redirected by role via `landingPathFor`.

**The copy only claims what the product does.** Features are the real ones — leads,
projects, FF&E procurement, trade accounts, invoicing, payments — and there are no
testimonials, customer counts or logos, because a marketing page is the easiest place for
an invented number to appear and this one is the first thing a real prospect reads. A test
asserts their absence, so a later edit has to be deliberate.

Pricing comes from `planPricing()`, the same source the sign-up form and billing page use,
so the number quoted can't drift from the number charged. "Free trial, no card required"
is likewise true rather than aspirational: sign-up creates a `TRIAL` firm and the billing
page collects nothing.

`/login` gained a link to sign up, and its logo now links home — a login form with no exit
was the other half of the same dead end.

Also pinned: `/`, `/login`, `/signup` and `/signup/billing` are **not** in the middleware
matcher. A matcher edit that put a wall in front of registration would otherwise be
invisible, since middleware failures look like redirects rather than errors.

### Looked at, not just tested

Unlike `/admin`, this page needs no session, so it was actually viewed at 1280px and
390px. That caught a layout bug the tests couldn't: the two pricing cards' buttons sat at
different heights, because only the yearly card has a savings line. Fixed by pushing the
button down with `mt-auto`.

---

## Bug fix: firm-scoped queries that ignored their firm

Reported after review: a newly created firm's `/app/settings` listed **every user on the
platform**, the platform operator included.

### Cause

`listUsers(firmId)` and `listDesigners(firmId)` in `src/server/queries/settings.ts` took a
`firmId` and **never used it** — no `where`. Both dated from the DES-25 isolation work,
where every query module was given an explicit firm; these two were missed. Nothing
complained: the parameter is "used" as far as TypeScript cares, and lint doesn't flag
unused parameters.

Reachable from two screens:

- `/app/settings` — the Users tab (reported), and the designer list the Permissions tab
  assigns overrides from.
- `/app/administration` — the user checkboxes for resource-folder permissions.

`GET /api/users` was **not** affected; it goes through the tenant client.

### Why the isolation gate didn't catch it

This is the part worth keeping. Every guard built in DES-25/26/27/28 is about the *tenant
client*: routes must use it, models must be scoped by it, nothing may bypass it. But page
components don't use it. They call `src/server/queries/*` with a firmId, and those
functions are **trusted** to apply it.

The gate proved "no route can reach another firm's rows" and quietly assumed the query
modules held up their end. Two of sixteen didn't. Trust was the whole hole.

### Fix, and closing the class

Both queries now filter by `firmId`. Beyond that:

- **`src/server/queryScoping.test.ts`** — a new structural guard over every exported
  function in `src/server/queries/`: it must use a firmId it accepts, must accept one if
  it queries at all, and must put it in a `where` rather than a `select` or `orderBy`.
- **Behavioural coverage in the isolation suite**, which is what actually proves a `where`
  works — each query module exercised against two real firms.
- **The two-firm fixture now seeds a platform operator** (`firmId: null`). Without one,
  "a row belonging to no firm leaks into a firm's view" was untestable, because every row
  in the fixture belonged to somebody. The per-model matrix now also asserts that no
  unowned row appears in either firm's view.

All three shapes of the bug were re-introduced on purpose and confirmed to fail:

| Breach | Result |
|---|---|
| `where` removed from `listUsers` | structural guard **and** the real-data test fail |
| A new query taking no firmId at all | structural guard fails |
| firmId used, but only in `orderBy` | structural guard fails |

A read-only check of the dev database confirmed the leak left no bad data behind: no
resource folder grants access to a user from another firm.

### The deeper issue, not fixed here

The query modules take raw prisma plus a firmId, so scoping is a *promise each author
keeps*. The tenant client makes it a *mechanism*. Converting `src/server/queries/*` to take
the tenant client would make this class of bug impossible rather than merely detected —
roughly 10 call sites. Out of scope for a bug fix; recommended as its own issue.
