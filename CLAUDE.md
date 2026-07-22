# CLAUDE.md

Guidance for working in this repository. Read the [README](README.md) for setup;
this file is about *how we build*.

## What this is

Design Firm Ops — an internal operations app for an interior design firm. Next.js
14 (App Router) + TypeScript, Prisma → Postgres (Supabase), NextAuth, Supabase
Storage, Resend, React-PDF. See the README for the full stack and layout.

## Core principles

### DRY — don't repeat yourself

- **Reuse before you write.** Before adding a helper, check
  [src/lib/](src/lib/) — pricing, money formatting, invoice numbering/status,
  permissions, validation, crypto, and financials already live there. Extend the
  existing module rather than reimplementing.
- **One source of truth per concept.** Business rules (markup, tax, rounding,
  invoice status) belong in `src/lib`, not inlined in a route handler or a React
  component. API routes and UI should *call* that logic, never duplicate it.
- **Shared UI goes in [src/components/](src/components/).** If two screens need
  the same dialog/table/field, lift it.
- When you catch yourself copy-pasting, stop and extract. A small well-named
  function beats a second copy that will drift.

### TDD — test-driven development

We are building up test coverage. For new or changed logic:

1. **Write the test first** — capture the expected behavior (and the edge cases)
   as failing tests before writing the implementation.
2. **Make it pass** with the simplest code that satisfies the test.
3. **Refactor** with the tests green — this is where DRY cleanup happens safely.

Prioritize tests for the pure business logic in `src/lib` (pricing, tax, invoice
status, money math) — it's the highest-value, easiest-to-test surface. Coverage
is intentionally partial right now; **add tests as you touch code** rather than
leaving a change untested. Don't remove or weaken a test to make a change pass.

## Testing

- Framework: **[Vitest](https://vitest.dev)** + **React Testing Library** for
  components. Config in [vitest.config.ts](vitest.config.ts) (the `@/` alias
  mirrors tsconfig, so tests import exactly like the app).
- Tests are **co-located** next to the module they cover. The **file extension
  picks the environment** via two Vitest projects:
  - **`*.test.ts`** → `node` environment, for pure logic (`src/lib`). See
    [src/lib/pricing.test.ts](src/lib/pricing.test.ts) for the house style
    (including a test that reproduces the reference invoice totals from the seed).
  - **`*.test.tsx`** → `jsdom` environment with jest-dom matchers and RTL
    auto-cleanup ([vitest.setup.ts](vitest.setup.ts)), for React components. See
    [src/components/ConfirmDialog.test.tsx](src/components/ConfirmDialog.test.tsx).
- Import test helpers explicitly: `import { describe, it, expect } from 'vitest'`.
- Commands:

  ```bash
  npm test            # run once (vitest run) — both projects
  npm run test:watch  # watch mode while developing
  ```

- **Component tests**: render with `@testing-library/react`, query by role/text
  (accessible queries), drive interaction with `@testing-library/user-event`, and
  assert with jest-dom matchers. Mock Next.js hooks (`next/navigation`) and other
  boundaries with `vi.mock` — see
  [src/app/app/projects/StatusFilter.test.tsx](src/app/app/projects/StatusFilter.test.tsx).
- Logic that needs Prisma/Supabase/network is **not** a unit test — mock the
  dependency, or leave it for the (future) integration layer. Prefer extracting
  the pure decision into `src/lib` so it *can* be unit-tested.

## Issue workflow (Linear → plan → PR)

We track work in **Linear**. When the developer gives you a Linear issue tag
(e.g. `ENG-123`), follow this process — **do not skip straight to coding**:

1. **Read the issue.** Fetch it from Linear via the Linear MCP server (to be
   configured) using the provided tag. Understand scope, acceptance criteria, and
   any linked context before planning. Mark the issue as In progress.
2. **Write a plan.** Create `plans/<TAG>_PLAN.md` (e.g. `plans/ENG-123_PLAN.md`)
   describing the approach: what changes, which files, the test strategy (TDD —
   what tests you'll write first), and any risks or open questions.
3. **Request review.** Ask the developer to review the plan. **Wait for explicit
   approval** — do not start the work until the plan is approved.
4. **Do the work** once approved, following the DRY/TDD principles above (tests
   first, keep `npm test` and `npm run lint` green).
5. **Branch, commit, push.** Create a new branch for the issue, commit the work,
   and push it to the branch. **Branch off `main` by default.** Sometimes an
   issue builds on work that isn't merged yet — in that case branch off the
   relevant feature branch instead. When it's not obvious which base to use, ask
   the developer before branching.
6. **Open a pull request** with the GitHub CLI (`gh pr create`), targeting the
   **`main`** branch. Reference the Linear tag in the PR. Don't worry about marking the issue as "In Review" the github integration with linear will do that automatically.

Only commit and push when the work for the issue is complete (or when the
developer asks). One branch + one PR per issue.

## Money & correctness rules

- **Never use floating-point for money.** All monetary math uses `decimal.js`.
  Use the helpers in [src/lib/pricing.ts](src/lib/pricing.ts) and
  [src/lib/money.ts](src/lib/money.ts); Prisma money columns are `Decimal`.
- **Rounding order matters:** round each unit price to the cent *first*, then
  extend by quantity, then sum for the subtotal — matching a human bookkeeper so
  totals reconcile to the cent. Don't round only at the end. This is enforced by
  the pricing tests; keep them green.

## Conventions

- **Commands:** `npm run dev | build | lint | test`; Prisma via
  `npm run prisma:generate | prisma:migrate | prisma:seed | prisma:studio`. Full
  first-run bootstrap: `npm run setup`.
- **Auth:** everything under `/app` is internal-only, gated in
  [src/middleware.ts](src/middleware.ts). Users are `ADMIN` or `DESIGNER`;
  respect the permission checks in [src/lib/permissions.ts](src/lib/permissions.ts).
- **Secrets:** vendor trade-account passwords are encrypted at rest via
  [src/lib/crypto.ts](src/lib/crypto.ts) (AES-256-GCM). Never log or return
  decrypted secrets to the client.
- **Validation:** validate API input with Zod (see
  [src/lib/validation.ts](src/lib/validation.ts)) rather than trusting the body.
- Match the surrounding code's style, naming, and comment density. Keep changes
  scoped; don't reformat unrelated code.

## Before you finish a change

- `npm test` passes (and you added tests for what you changed).
- `npm run lint` is clean.
- No new money math on floats; no logic duplicated that already exists in `src/lib`.
