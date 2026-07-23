# DES-35 — Refactor to not use Supabase for the database, only file storage

**Linear:** [DES-35](https://linear.app/design-firm-ops/issue/DES-35) · milestone _Initial Refactor_
**Status:** plan for review — no code written yet.

## Goal

Stop using Supabase as the **database** provider. Keep Supabase **only for file
storage** (documents, resources, branding buckets). The Postgres database should run
as a standalone Postgres, independent of any Supabase project.

## Why this is small (and where it isn't)

The app is already decoupled at the code layer — Prisma talks to whatever
`DATABASE_URL` points at, and **every** `supabase` reference in `src/` is file storage
(`src/lib/supabase.ts` + the upload/signed-URL API routes). So no application/runtime
code changes.

The actual coupling is in **tooling and docs**:

- `scripts/setup.mjs` provisions a local Supabase stack and pipes **its embedded
  Postgres** into `DATABASE_URL`/`DIRECT_URL` (lines 221–229). This is the one place
  the DB is tied to Supabase.
- `DIRECT_URL` + `datasource.directUrl` exist only because Supabase's pooled
  connection needs a separate direct connection for migrations — a Supabase-ism.
- Docs/comments describe "Postgres (hosted on Supabase)".

## Scope of changes

### 1. Decouple DB provisioning in `scripts/setup.mjs`
Split the current single "provision Supabase → use its DB + keys" path into two
independent concerns:
- **Database (standalone Postgres):** provision a plain Postgres for local dev instead
  of borrowing Supabase's. Recommended: run a dedicated `postgres:16` Docker container
  (Docker is already an assumed prerequisite for the local stack), write its URL to
  `DATABASE_URL`. Fall back to prompting for `DATABASE_URL` (as today with
  `--no-supabase`).
- **Storage (Supabase):** still provision Supabase, but consume **only** its API URL +
  keys (`apiUrl`, `anonKey`, `serviceKey`) — no longer read `sb.dbUrl` into
  `DATABASE_URL`.
- Update flags/help text: `--no-supabase` should mean "skip Supabase **storage**
  provisioning" and its DB responsibility moves under a general DB step. Keep
  `--skip-db` / `--skip-seed` semantics.

### 2. Drop the Supabase pooling artifact (`DIRECT_URL`)
- Remove `directUrl = env("DIRECT_URL")` from `prisma/schema.prisma`'s datasource;
  a standalone Postgres uses one connection string.
- Remove `DIRECT_URL` from `.env.example` and stop writing it in `setup.mjs`.
- _(Tradeoff — see Open Questions: if the team later deploys behind a connection
  pooler, `directUrl` may need to come back. Alternative: keep it but default it equal
  to `DATABASE_URL`.)_

### 3. Docs & comments
- `README.md`: rework the stack/prereqs/env-table lines that say "Postgres (hosted on
  Supabase)" and the `DATABASE_URL`/`DIRECT_URL` row (lines ~6, 12, 23–31, 48–64, 89).
  New framing: **Postgres (standalone) for data; Supabase for Storage only.** Document
  how local dev gets its Postgres (Docker container) and that Supabase is now storage-
  only.
- `.env.example`: retitle the top block ("Postgres connection string" instead of
  "Postgres (Supabase)"); regroup so the Supabase keys are clearly the **Storage**
  section.
- `prisma/schema.prisma`: header comment "Postgres (Supabase)" → "Postgres".

### Explicitly out of scope / unchanged
- `src/lib/supabase.ts`, `DOCUMENTS_BUCKET`/`RESOURCES_BUCKET`/`LOGO_BUCKET`, and every
  upload/signed-URL API route — storage stays on Supabase.
- Prisma schema models/migrations — the data model doesn't change.
- No data migration (this is about where Postgres runs, not its contents).

## Test / verification strategy

This is infra/config, so there's little pure logic to unit-test (per CLAUDE.md's TDD
guidance, I'll extract a testable helper only if a decision point warrants it — e.g. a
small pure function for building the Postgres container URL in `setup.mjs`, which I can
unit-test).

Verification:
- `npm test` stays green (no logic changed).
- `npm run build` + `npm run lint` clean.
- **Smoke the setup path**: run `node scripts/setup.mjs --yes` against a clean env and
  confirm it (a) brings up a standalone Postgres, (b) runs migrations + seed against it,
  (c) still wires Supabase storage keys, and (d) `npm run dev` boots and a document
  upload still works via Supabase storage.

## Risks
- **Local topology now runs two things** (standalone Postgres + Supabase for storage).
  Slightly heavier locally, but it mirrors the intended prod split. Called out in the
  Open Questions.
- Removing `DIRECT_URL` is a schema change — anyone with an existing `.env` should drop
  the now-unused var (harmless if left). Migrations are unaffected.

## Decisions (resolved)
1. **Local Postgres provisioning:** _Bring-your-own._ `setup.mjs` prompts for
   `DATABASE_URL` (defaulting to a local Postgres) as its own DB step; the developer
   runs their own Postgres. No Docker-container spinning in the script.
2. **`DIRECT_URL`:** _Remove entirely._ Drop `directUrl` from the datasource and
   `DIRECT_URL` from env/setup.
3. **Local storage:** _Keep the local Supabase CLI stack_, but for **Storage only** —
   `provisionSupabase()` stays but no longer reads `dbUrl`; it returns only the API URL
   and keys.

## Branch / PR
Branch `josephditton/des-35-...` off `main`; PR referencing DES-35 targeting `main`.
