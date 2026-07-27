# DES-27 — Firm lifecycle: detail page + suspend / reactivate / cancel

**Linear:** [DES-27](https://linear.app/design-firm-ops/issue/DES-27/firm-lifecycle-management-detail-page-suspend-reactivate-cancel) · milestone _Phase 3_ · **High**
**Context:** [plans/ADMIN_DASHBOARD.md](ADMIN_DASHBOARD.md) §4.5 · builds directly on DES-26 (PR #13, open)

The console gets teeth: a per-firm detail page, and the ability to suspend, reactivate or
cancel a firm — with the login gate actually honoring the result.

## What's already true

DES-26 built the cross-firm door (`getPlatformDb`), the firms list, and `FirmStatus` in
`src/lib/domain.ts`. The `Firm.status` column exists and has been carrying TRIAL / ACTIVE
/ SUSPENDED / CANCELED since DES-23 — **but nothing has ever read it.** Today you can set
a firm to SUSPENDED and its users keep working exactly as before.

So the centre of this issue is not the buttons. It's making the status mean something.

## The login gate

`authorize()` in `src/server/auth.ts` currently checks `user.active` and the password. It
needs to also refuse a user whose firm is suspended or canceled — with a *clear message*,
per the acceptance criteria, rather than the generic "Invalid email or password."

Two things that matter here, neither obvious:

**Order the checks so the message can't leak.** The firm-status check must come *after*
the password comparison. Otherwise "this firm is suspended" tells anyone who guesses an
email that the account exists and which firm it belongs to. Checked in that order, the
message is only ever shown to someone who already proved they hold the credentials.

**NextAuth can carry a reason, but only by throwing.** I read the mechanism in
`node_modules/next-auth/core/routes/callback.js` rather than assuming: returning `null`
from `authorize` always produces `CredentialsSignin`, while a *thrown* error redirects to
`?error=<encodeURIComponent(error.message)>`, which `signIn(…, { redirect: false })`
surfaces as `result.error`. So the gate throws a short stable **code**
(`FIRM_SUSPENDED` / `FIRM_CANCELED`) and the login page maps codes to sentences. Codes
rather than prose because the value travels through a URL and is matched on.

The decision itself goes in a pure `src/lib/firmAccess.ts` — status in, denial code or
null out — so it is unit-testable without NextAuth, and so the login page and the server
agree on the vocabulary.

## Detail page — `/admin/firms/[id]`

- **Identity**: name, slug, status, plan, created.
- **Usage**: users (name, email, role, active) plus project / invoice counts and last
  activity, reusing the aggregates `listFirms` already computes.
- **Actions**: Suspend · Reactivate · Cancel, each behind `ConfirmDialog` per house rules.

`FirmStatusBadge` gets extracted from the `STATUS_STYLES` map I inlined in the list page
in DES-26 — two screens now render the same badge, which is the point at which it should
be lifted rather than copied.

### Transitions are rules, not buttons

Which moves are legal belongs in a pure function, not in whichever buttons a page happens
to render, and it must be enforced server-side because the API route is reachable directly:

| From | May become |
|---|---|
| TRIAL | ACTIVE · SUSPENDED · CANCELED |
| ACTIVE | SUSPENDED · CANCELED |
| SUSPENDED | ACTIVE · CANCELED |
| CANCELED | ACTIVE |

Nothing returns to TRIAL — a trial is a starting state, not somewhere you go back to.
CANCELED is reversible precisely because the issue forbids hard-deleting: the data is all
still there, so "reactivate" is a status flip like any other.

## The first `/admin` API route

DES-26 deliberately added none. This issue needs one — `PATCH /api/admin/firms/[id]/status`
— which runs straight into a guard I wrote last week: *"every API route uses the
tenant-scoped client."*

That guard stays, and gets widened honestly rather than exempted: a route must use the
tenant client **or** be an `/api/admin` route using `getPlatformDb`. A new route that uses
neither still fails. `requireOperator()` joins `requireSession`/`requireAdmin` in
`apiAuth.ts`, returning 403 for anyone who isn't the platform operator, so the check reads
the same as every other route's.

## Test strategy (TDD — tests first)

| Layer | File | What it pins |
|---|---|---|
| Pure | `src/lib/firmAccess.test.ts` | which statuses deny login; codes map to messages; a null firm (the operator) is never denied |
| Pure | `src/lib/firmStatus.test.ts` | the transition table, both directions — every legal move allowed, every illegal one refused, including no-ops and unknown values |
| Server | `src/server/auth.test.ts` | password is checked *before* firm status; suspended/canceled throw the right code; active signs in |
| Server | `src/server/queries/firms.test.ts` | the detail query returns users and usage for one firm |
| Component | `FirmStatusBadge.test.tsx` | each status renders its label |
| Component | `FirmActions.test.tsx` | confirms before acting; only legal actions offered; failure surfaces |
| Structural | `isolationGuards.test.ts` | admin routes go through the platform client; the widened rule still catches an unscoped route |
| Integration | `tenant.isolation.test.ts` | suspending firm A leaves firm B untouched and its users able to sign in |

That last one is the one I'd most want to exist. "Suspend" is the first console action that
*writes* across the tenant boundary, and the failure that would matter is suspending the
wrong firm, or all of them.

## Risks

- **The login gate is a lockout switch.** A wrong transition table or an inverted check
  locks real users out of a working firm. Hence the pure transition rules, tested
  exhaustively, and the ordering rule above.
- **Guard erosion.** Widening the API-route guard is exactly the kind of change that
  quietly turns a real check into a rubber stamp; it will be probe-tested by adding an
  unscoped route and confirming it still fails.
- **Exemption-list drift.** Audit logging forces DES-31's "exactly one exempt model"
  assertion open. Splitting the list by reason (below) keeps it a real check rather than a
  list that grows whenever something doesn't fit.

## Decisions _(2026-07-27)_

- **Base branch:** DES-26 (PR #13) merges first; this branches off `main`, so DES-27's PR
  shows only its own changes.
- **Audit log:** a minimal `AuditLog` model lands here rather than waiting for DES-30 —
  actor, action, target firm, from/to status, timestamp — written on every status change.
  DES-30 extends the vocabulary and adds the UI. This meets the acceptance criterion now
  and spares DES-30 from having to re-find every mutation site later.
- **Live sessions:** suspension takes effect on the next request, not the next token.
  Checked in `requireSession` and the `/app` layout — one indexed lookup per authenticated
  request. A suspend that leaves the firm working for hours isn't a suspend.

### A sharp edge in the audit-log decision

`AuditLog` carries a `firmId`, and DES-31's structural guard requires **every** model to
carry `firmId` *or* be deliberately exempt — with a test pinning the exempt list to
exactly one entry (`Firm`). This model is the first thing that doesn't fit either shape:
its `firmId` is the *target* of an action, not an owner, and a firm must never read its
own audit trail.

Leaving it tenant-scoped would be wrong (it would filter by the acting firm, which is
meaningless), but simply adding it to `UNSCOPED_MODELS` would be worse: that set means
"don't filter this", so firm-facing code reaching it would see **every firm's** audit
records. That is precisely the hole DES-31 exists to prevent.

So the exemption list splits in two, by reason:

- **`UNSCOPED_MODELS`** — `Firm`. Not filtered; legitimately reachable through the
  platform path.
- **`PLATFORM_ONLY_MODELS`** — `AuditLog`. The tenant client **throws** on it rather than
  passing it through. Fail-closed: firm-facing code cannot read it even by accident.

The guard test changes from "exempts only the tenant root" to asserting each model is in
exactly one bucket for a stated reason — which is a stronger check than the one it
replaces, not a weakened one.

## Out of scope

- The audit log's own UI and the full event vocabulary — DES-30.
- Provisioning / creating firms — DES-28. Platform metrics — DES-29.
- Editing a firm's name, slug or plan: this issue is about *lifecycle*, and a rename is a
  different (and less consequential) feature.

---

## What shipped

**589 tests** (was 527), 52 of them in the isolation suite. Lint, tsc, coverage gate and
build clean; `/admin/firms/[id]` and `/api/admin/firms/[id]/status` appear in the build.

### The status column finally means something

`Firm.status` had existed since DES-23 with nothing reading it. It is now enforced in two
places, deliberately:

- **At sign-in** (`authorize`), *after* the password check. That ordering is the whole
  safety of the feature: it means "this account is suspended" is only ever shown to
  someone who already proved they hold the credentials, so it can't be used to discover
  which addresses exist. Pinned by a test that a wrong password on a suspended firm still
  returns the generic null.
- **On every authenticated request** (`requireSession`, `/app` layout). Sessions are JWTs,
  so the login gate alone would have left a suspended firm working until each user's token
  expired — hours. One indexed lookup buys "suspended" actually meaning suspended.

### Guards widened, then proven still sharp

Adding the first `/api/admin` route collided with DES-26's *"every API route uses the
tenant-scoped client."* Rather than exempt it, the rule became "tenant client **or** an
`/api/admin` route using the platform client", plus a new guard that admin routes use
`requireOperator` and not the firm guard.

Five deliberate breaches, each reverted:

| Breach | Result |
|---|---|
| `/api/admin` route using neither guarded client | widened guard fails |
| `/api/admin` route guarded as if a firm were calling | new operator guard fails |
| **Ordinary** API route using neither client | widened guard **still** fails |
| Login gate stops reading firm status | 2 auth tests fail |
| Transition table allows ACTIVE → ACTIVE | 4 transition tests fail |

The third row is the one that mattered: it shows the widening adjusted the rule rather
than retiring it.

### The exemption split

As planned, `PLATFORM_ONLY_MODELS` now sits beside `UNSCOPED_MODELS`, and the tenant
client **throws** on `AuditLog` rather than passing it through unfiltered. DES-31's
"exactly one exempt model" assertion became "each exemption is in exactly one bucket, for
a stated reason", with an overlap check — stricter than what it replaced.

### Verified end to end

Against a running server with two firms, using minted session tokens (no credentials
typed):

| Call | Before | After suspending Alpha |
|---|---|---|
| Alpha user → `GET /api/offerings` | 200 | **403** "This account is suspended…" |
| Alpha user → `/app/projects` | 200 | **307** → `/login?error=FIRM_SUSPENDED` |
| **Beta** user → `GET /api/offerings` | 200 | **200** — untouched |

Plus: firm admin → `PATCH status` **403**; signed out **401**; `SUSPENDED → SUSPENDED`
**409**; back to `TRIAL` **409**; invalid value **400**; unknown firm **404**; reactivate
**200** and access restored.

The audit trail held exactly two rows — `firm.suspend` then `firm.activate`, with the
right actor and `{from, to}` — and **the refused calls wrote none**, because the record is
written inside the same transaction as the change. Both firms kept every project and user:
nothing is ever deleted.

### A UX bug the tests found

Writing the confirm-dialog test surfaced two buttons named "Cancel" with opposite
meanings — the dialog's dismiss, and the *cancel this firm* action. Confirm buttons now
read "Cancel firm" / "Suspend firm" / "Reactivate firm", with a test pinning that the two
stay distinguishable.

### Not verified live

The sign-in path itself was exercised only by unit tests (7, including the ordering
property). Confirming it against the running server would mean posting a password to the
credentials endpoint, which is the same act as typing one into the form.
