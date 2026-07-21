#!/usr/bin/env node
// Cross-platform first-run setup for Design Firm Ops.
//
// Written in Node (already a prerequisite) so it runs identically on
// Windows, macOS, and Linux without bash/PowerShell. It is idempotent —
// safe to re-run; an existing .env is backed up before being replaced.
//
//   npm run setup
//
// What it does:
//   1. Verifies Node 20+.
//   2. Builds .env interactively — provisions a local Supabase dev stack
//      (via the Supabase CLI) and pulls its database URL + API keys in,
//      generates the secret values, and prompts for the rest.
//   3. Installs dependencies and generates the Prisma client.
//   4. Applies migrations and (optionally) seeds demo data.
//
// Flags:
//   --yes           Accept defaults for every prompt (non-interactive).
//   --no-supabase   Don't provision local Supabase; prompt for DB/keys instead.
//   --skip-db       Skip Supabase provisioning, migrations, and seed.
//   --skip-seed     Run migrations but skip seeding.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = new Set(process.argv.slice(2));
const AUTO = argv.has('--yes');
const SKIP_DB = argv.has('--skip-db');
const SKIP_SEED = argv.has('--skip-seed');
const NO_SUPABASE = argv.has('--no-supabase') || SKIP_DB;

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// --- tiny logging helpers (no external deps) ---
const step = (msg) => console.log(`\n\x1b[1m\x1b[36m▸ ${msg}\x1b[0m`);
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`);
const die = (msg) => {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  rl?.close();
  process.exit(1);
};

// Notes surfaced at the very end (e.g. generated seed passwords).
const finalNotes = [];

let rl;
function ensureRl() {
  rl ??= createInterface({ input: stdin, output: stdout });
  return rl;
}

async function confirm(question, defaultYes = true) {
  if (AUTO) return defaultYes;
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = (await ensureRl().question(`  ${question} [${hint}] `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer.startsWith('y');
}

// Prompt for a value, showing a default. In --yes mode the default is used.
async function prompt(label, def = '', { optional = false } = {}) {
  if (AUTO) return def;
  const shown = def ? ` [${def}]` : optional ? ' (optional)' : '';
  const answer = (await ensureRl().question(`  ${label}${shown}: `)).trim();
  return answer || def;
}

const genSecret = () => randomBytes(32).toString('base64');
const genPassword = () => randomBytes(9).toString('base64url');

// --- .env template helpers (preserve .env.example's comments/grouping) ---
function getEnvVar(env, key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].replace(/^["']|["']$/g, '') : '';
}
function setEnvVar(env, key, value) {
  const line = `${key}=${JSON.stringify(value ?? '')}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
}

// A cross-platform command runner. Returns {ok, stdout}. When `capture`
// is false, output streams straight to the terminal.
function exec(command, args, { capture = false, allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: false,
  });
  const success = !result.error && result.status === 0;
  if (!success && !allowFail) {
    if (result.error) die(`Failed to run ${command}: ${result.error.message}`);
    die(`\`${command} ${args.join(' ')}\` failed (exit code ${result.status}).`);
  }
  return { ok: success, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function labeledRun(command, args, label) {
  step(label);
  exec(command, args);
}

// --- Node version check ---
function checkNode() {
  step('Checking Node.js version');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) die(`Node 20+ is required. You are on ${process.version}.`);
  ok(`Node ${process.version}`);
}

// --- Supabase CLI resolution ---
// Prefer a globally installed `supabase`; otherwise fall back to `npx`,
// which fetches the CLI wrapper on first use and caches it.
let supabaseCmd = null;
function resolveSupabaseCmd() {
  if (supabaseCmd) return supabaseCmd;
  const bin = process.platform === 'win32' ? 'supabase.cmd' : 'supabase';
  const probe = exec(bin, ['--version'], { capture: true, allowFail: true });
  supabaseCmd = probe.ok ? [bin] : [NPX, '--yes', 'supabase'];
  return supabaseCmd;
}
function supabase(args, opts) {
  const cmd = resolveSupabaseCmd();
  return exec(cmd[0], [...cmd.slice(1), ...args], opts);
}

// Provision a local Supabase stack and return its connection details, or
// null if provisioning was skipped or failed (caller falls back to prompts).
async function provisionSupabase() {
  if (NO_SUPABASE) return null;

  const wanted = await confirm(
    'Provision a local Supabase dev stack now? (requires Docker to be running)',
    true
  );
  if (!wanted) return null;

  step('Setting up local Supabase');

  // `supabase start` needs a project scaffold (supabase/config.toml).
  if (!existsSync(join(ROOT, 'supabase', 'config.toml'))) {
    // Inherits the terminal, so any "generate editor settings?" prompts
    // from `supabase init` are answered by the user running this script.
    const init = supabase(['init'], { allowFail: true });
    if (!init.ok) {
      warn('`supabase init` failed — is the Supabase CLI available? Falling back to manual entry.');
      return null;
    }
    ok('Initialized supabase/ project scaffold.');
  }

  console.log('  Starting containers (first run pulls images — this can take a few minutes)...');
  const started = supabase(['start'], { allowFail: true });
  if (!started.ok) {
    warn('`supabase start` failed — is Docker installed and running? Falling back to manual entry.');
    return null;
  }

  const status = supabase(['status', '-o', 'json'], { capture: true, allowFail: true });
  if (!status.ok) {
    warn('Could not read `supabase status`. Falling back to manual entry.');
    return null;
  }

  let data;
  try {
    data = JSON.parse(status.stdout);
  } catch {
    warn('Could not parse Supabase status output. Falling back to manual entry.');
    return null;
  }

  const apiUrl = data.API_URL ?? data.api_url;
  const dbUrl = data.DB_URL ?? data.db_url;
  const anonKey = data.ANON_KEY ?? data.anon_key;
  const serviceKey = data.SERVICE_ROLE_KEY ?? data.service_role_key;
  if (!apiUrl || !dbUrl || !anonKey || !serviceKey) {
    warn('Supabase status was missing expected fields. Falling back to manual entry.');
    return null;
  }

  ok('Local Supabase is running.');
  if (data.STUDIO_URL ?? data.studio_url) {
    console.log(`  Studio: ${data.STUDIO_URL ?? data.studio_url}`);
  }
  return { apiUrl, dbUrl, anonKey, serviceKey };
}

// --- Interactive .env construction ---
async function setupEnv() {
  step('Configuring .env');
  const envPath = join(ROOT, '.env');
  const examplePath = join(ROOT, '.env.example');
  if (!existsSync(examplePath)) die('.env.example is missing; cannot build .env.');

  if (existsSync(envPath)) {
    const redo = await confirm('.env already exists. Reconfigure it? (a backup will be saved)', false);
    if (!redo) {
      ok('Keeping existing .env.');
      return;
    }
    const backup = `${envPath}.bak`;
    renameSync(envPath, backup);
    warn(`Backed up existing .env to ${backup}`);
  }

  // Start from the example so all comments/grouping are preserved.
  let env = readFileSync(examplePath, 'utf8');

  // Supabase: provision locally, or collect the values by hand.
  const sb = await provisionSupabase();
  if (sb) {
    env = setEnvVar(env, 'DATABASE_URL', sb.dbUrl);
    env = setEnvVar(env, 'DIRECT_URL', sb.dbUrl);
    env = setEnvVar(env, 'NEXT_PUBLIC_SUPABASE_URL', sb.apiUrl);
    env = setEnvVar(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', sb.anonKey);
    env = setEnvVar(env, 'SUPABASE_SERVICE_ROLE_KEY', sb.serviceKey);
    env = setEnvVar(env, 'SUPABASE_JWKS_URL', `${sb.apiUrl}/auth/v1/.well-known/jwks.json`);
    ok('Wrote database URL and Supabase keys from the local stack.');
  } else {
    step('Database & Supabase (enter values, or accept the examples for now)');
    const dbUrl = await prompt('DATABASE_URL', getEnvVar(env, 'DATABASE_URL'));
    env = setEnvVar(env, 'DATABASE_URL', dbUrl);
    env = setEnvVar(env, 'DIRECT_URL', await prompt('DIRECT_URL', dbUrl));
    const apiUrl = await prompt('NEXT_PUBLIC_SUPABASE_URL', getEnvVar(env, 'NEXT_PUBLIC_SUPABASE_URL'));
    env = setEnvVar(env, 'NEXT_PUBLIC_SUPABASE_URL', apiUrl);
    env = setEnvVar(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', await prompt('NEXT_PUBLIC_SUPABASE_ANON_KEY (sb_publishable_...)', getEnvVar(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')));
    env = setEnvVar(env, 'SUPABASE_SERVICE_ROLE_KEY', await prompt('SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)', getEnvVar(env, 'SUPABASE_SERVICE_ROLE_KEY')));
    env = setEnvVar(env, 'SUPABASE_JWKS_URL', `${apiUrl}/auth/v1/.well-known/jwks.json`);
  }

  // App URL.
  step('Application');
  env = setEnvVar(env, 'NEXTAUTH_URL', await prompt('NEXTAUTH_URL', getEnvVar(env, 'NEXTAUTH_URL') || 'http://localhost:3000'));

  // Secrets — always generated, never prompted.
  env = setEnvVar(env, 'NEXTAUTH_SECRET', genSecret());
  env = setEnvVar(env, 'CREDENTIALS_ENCRYPTION_KEY', genSecret());
  ok('Generated NEXTAUTH_SECRET and CREDENTIALS_ENCRYPTION_KEY.');

  // External services — optional, safe to leave blank for local dev.
  step('External services (optional — leave blank to skip)');
  env = setEnvVar(env, 'RESEND_API_KEY', await prompt('RESEND_API_KEY (sending invoice email)', '', { optional: true }));
  env = setEnvVar(env, 'RESEND_FROM_EMAIL', await prompt('RESEND_FROM_EMAIL', getEnvVar(env, 'RESEND_FROM_EMAIL')));
  env = setEnvVar(env, 'ANTHROPIC_API_KEY', await prompt('ANTHROPIC_API_KEY (document extraction)', '', { optional: true }));

  // Seed accounts — prompt for emails, generate the passwords.
  step('Seed accounts (created by the seed step)');
  for (const [emailKey, pwKey, label] of [
    ['SEED_OWNER1_EMAIL', 'SEED_OWNER1_PASSWORD', 'Owner 1 (admin)'],
    ['SEED_OWNER2_EMAIL', 'SEED_OWNER2_PASSWORD', 'Owner 2 (admin)'],
    ['SEED_DESIGNER_EMAIL', 'SEED_DESIGNER_PASSWORD', 'Designer'],
  ]) {
    const email = await prompt(`${label} email`, getEnvVar(env, emailKey));
    const password = genPassword();
    env = setEnvVar(env, emailKey, email);
    env = setEnvVar(env, pwKey, password);
    finalNotes.push(`${label}: ${email} / ${password}`);
  }
  ok('Generated seed-account passwords (shown at the end).');

  writeFileSync(envPath, env);
  ok('Wrote .env');
}

// --- migrations + seed ---
async function setupDatabase() {
  if (SKIP_DB) {
    warn('Skipping database migrations and seed (--skip-db).');
    return;
  }
  const doMigrate = await confirm('Apply database migrations now?', true);
  if (!doMigrate) {
    warn('Skipped migrations. Run "npm run prisma:migrate" once your database is configured.');
    return;
  }
  labeledRun(NPM, ['run', 'prisma:migrate'], 'Applying migrations (prisma migrate dev)');

  if (SKIP_SEED) {
    warn('Skipping seed (--skip-seed).');
    return;
  }
  const doSeed = await confirm('Seed demo data (accounts, vendors, demo project)?', true);
  if (doSeed) {
    labeledRun(NPM, ['run', 'prisma:seed'], 'Seeding database');
  } else {
    warn('Skipped seed. Run "npm run prisma:seed" anytime to load demo data.');
  }
}

async function main() {
  console.log('\x1b[1mDesign Firm Ops — setup\x1b[0m');
  checkNode();
  await setupEnv();
  labeledRun(NPM, ['install'], 'Installing dependencies (npm install)');
  labeledRun(NPM, ['run', 'prisma:generate'], 'Generating Prisma client');
  await setupDatabase();

  step('Done');
  ok('Setup complete. Start the dev server with:  npm run dev');
  console.log('  Then open http://localhost:3000 and sign in at /login.');
  if (finalNotes.length) {
    console.log('\n\x1b[1mSeed account credentials\x1b[0m (save these — passwords were generated):');
    for (const note of finalNotes) console.log(`  ${note}`);
  }
  rl?.close();
}

main().catch((err) => {
  die(err?.message ?? String(err));
});
