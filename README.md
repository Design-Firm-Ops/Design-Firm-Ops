# Design Firm Ops

Internal operations app for an interior design firm (Madison Ditton Interiors). It
manages the full engagement lifecycle — business development leads, projects,
FF&E procurement, vendor/trade accounts, invoicing, and payments — in a single
Next.js application backed by Postgres and Supabase Storage.

## Tech stack

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Tailwind CSS** for styling
- **Prisma** ORM against **Postgres** (hosted on Supabase)
- **NextAuth** (credentials provider, JWT sessions) for internal auth
- **Supabase Storage** for documents, resources, and branding (private buckets +
  signed URLs)
- **Resend** for transactional email (sending invoices)
- **@react-pdf/renderer** for invoice PDF generation
- Optional: **Anthropic API** for document extraction (later phase)

## Prerequisites

- **Node.js 20+** (developed on Node 24; [.nvmrc](.nvmrc) pins 24.18.0 — run `nvm use`)
- **Docker** — only if you use `npm run setup` to provision a local Supabase
  stack (the Supabase CLI runs the services in containers). Not needed if you
  point at a hosted Supabase/Postgres.
- A **Postgres** database. The easiest paths are `npm run setup`'s local Supabase
  stack, or a free hosted [Supabase](https://supabase.com) project — either also
  provides the Storage buckets. A plain local Postgres works too if you don't need
  file uploads/email.
- Accounts/keys for the external services you plan to exercise:
  - **Supabase** (Postgres + Storage) — required for documents/logos
  - **Resend** — required only to actually send invoice emails
  - **Anthropic** — optional, for document extraction

## Quick start

The fastest path is the cross-platform setup script (works on Windows, macOS,
and Linux — it's plain Node, no bash required):

```bash
npm install   # first, so the script itself can run
npm run setup
```

The script walks you through a full first-run setup:

- Verifies your Node version.
- **Provisions a local Supabase dev stack** via the Supabase CLI (`supabase
  start`) and pulls its database URL and API keys straight into `.env`. This
  needs **Docker** running; if you'd rather point at your own Postgres/Supabase,
  pass `--no-supabase` and it prompts for those values instead.
- **Generates** the secret values (`NEXTAUTH_SECRET`,
  `CREDENTIALS_ENCRYPTION_KEY`, and the seed-account passwords) and **prompts**
  for everything else (app URL, Resend/Anthropic keys, seed emails). Optional
  keys can be left blank.
- Installs dependencies, generates the Prisma client, and offers to run
  migrations and seed demo data.

It's idempotent — safe to re-run. An existing `.env` is backed up (to `.env.bak`)
before it's rewritten, and the generated seed-account credentials are printed at
the end so you can sign in.

Flags: `--yes` (accept all defaults, non-interactive), `--no-supabase` (skip local
Supabase, prompt for DB/keys), `--skip-db` (skip Supabase + migrations + seed),
`--skip-seed` (migrate but don't seed).

For the manual, step-by-step version, read on.

## Getting started (manual)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in real values:

```bash
cp .env.example .env
```

Key variables (see [.env.example](.env.example) for the full list):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection strings. With Supabase, `DATABASE_URL` is the pooled connection and `DIRECT_URL` the direct one (used for migrations). |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`). |
| `NEXTAUTH_SECRET` | Long random string. Generate with `openssl rand -base64 32`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (`sb_secret_...`) — used server-side for uploads and signed URLs. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Resend credentials for sending invoices. |
| `ANTHROPIC_API_KEY` | Optional — document extraction. |
| `CREDENTIALS_ENCRYPTION_KEY` | Encrypts stored vendor trade-account passwords at rest. Generate with `openssl rand -base64 32`. |
| `SEED_*` | Emails/passwords for the accounts created by the seed script. |

### 3. Set up the database

Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` runs `prisma migrate dev`, which applies the migrations in
[prisma/migrations/](prisma/migrations/) to your database.

### 4. Seed data (recommended)

```bash
npm run prisma:seed
```

This creates:

- **2 owner accounts** (`ADMIN`) and **1 demo designer** (`DESIGNER`) — credentials
  come from the `SEED_*` env vars (defaults print to the console on seed).
- Company settings, default CRM pipeline stages, and the firm's ~65-vendor FF&E
  list.
- A demo project ("Westland Reserve Red Rock Office") with 13 lighting line items
  and sample invoicing/payment data.

The seed script clears prior demo project data on each run so it's safe to
re-run; leads, referral partners, and pipeline stages are treated as persistent
and are preserved.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in at `/login` with a
seeded account. The internal app lives under `/app`.

## Supabase Storage

The app uses three buckets, created automatically on first upload if missing:

- `documents` — **private**; client contracts/invoices/presentations, served via
  short-lived signed URLs.
- `resources` — **private**; internal firm templates and materials.
- `branding` — **public**; the company logo (stable URL for `<img>`/PDFs).

No manual bucket setup is required as long as `SUPABASE_SERVICE_ROLE_KEY` is set.

## npm scripts

| Script | Description |
| --- | --- |
| `npm run setup` | Cross-platform first-run setup (env, install, generate, migrate, seed). |
| `npm test` | Run the unit test suite once (Vitest). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run Next.js/ESLint checks. |
| `npm run prisma:generate` | Regenerate the Prisma client. |
| `npm run prisma:migrate` | Apply migrations in dev (`prisma migrate dev`). |
| `npm run prisma:seed` | Seed the database (see above). |
| `npm run prisma:studio` | Open Prisma Studio to browse the DB. |

## Project structure

```
prisma/
  schema.prisma        # Data model (Postgres). Money fields use Decimal.
  migrations/          # Migration history
  seed.ts              # Seed script (users, vendors, demo project)
  vendorData.ts        # Raw FF&E vendor import data
src/
  app/
    api/               # Route handlers (REST-ish API)
    app/               # Authenticated internal UI (projects, vendors, etc.)
    login/             # Sign-in page
  components/          # Shared React components
  lib/                 # Auth, Prisma, Supabase, financials, PDF, permissions
  middleware.ts        # Gates /app/* behind NextAuth
```

## Notes

- Everything under `/app` is internal-only and requires authentication
  (enforced in [src/middleware.ts](src/middleware.ts)).
- Monetary values always use `Decimal`, never floating point — see
  [src/lib/money.ts](src/lib/money.ts) and the pricing/financials helpers.
- Users have `ADMIN` or `DESIGNER` roles; some features are permission-gated.
</content>
</invoke>
