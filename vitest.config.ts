import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Mirror the tsconfig "@/*" -> "src/*" path so tests import exactly the
// way the app does. Shared across both projects (DRY).
const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    // Two projects so pure logic stays in the fast `node` environment and
    // only React component tests pay for jsdom + the React plugin.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['src/**/*.isolation.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        // The tenant-isolation correctness gate. Runs the real tenant client
        // against a real Postgres, so it needs a database and its own timeouts.
        // It skips (loudly) when DATABASE_URL is absent, which keeps `npm test`
        // green in a fresh clone — CI is where it is actually enforced.
        // See plans/DES-31_PLAN.md.
        resolve: { alias },
        test: {
          name: 'isolation',
          environment: 'node',
          include: ['src/**/*.isolation.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          // One database, one fixture — parallel files would race on it.
          fileParallelism: false,
        },
      },
    ],

    // Coverage is measured on the layers that are *meant* to be unit-tested —
    // the pure domain logic, the shared UI, and the server-side logic modules.
    // API routes and page components are excluded on purpose: they're wiring
    // that needs Prisma, next-auth, and a request/response pair, so covering
    // them belongs to an integration layer rather than these unit tests.
    // Including them would drag the global number down to noise and make a
    // threshold meaningless. See plans/DES-34_PLAN.md.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/server/**', 'src/components/**'],
      exclude: [
        '**/*.test.*',
        '**/*.isolation.test.ts',
        'src/test/**',
        // Thin read wrappers over Prisma — no logic of their own to verify.
        'src/server/queries/**',
        // Wiring with nothing to assert.
        'src/components/Providers.tsx',
        'src/server/prisma.ts',
        // contentEditable / React-PDF rendering: a snapshot here would be
        // high-churn and low-signal. The parsing behind it (parseRichText) and
        // the pricing behind the PDF are both covered directly.
        'src/components/RichTextEditor.tsx',
        'src/lib/pdf/InvoiceDocument.tsx',
        'src/server/pdf/**',
      ],
      // Set just under the levels these layers actually hit, so the gate
      // catches regressions without failing on rounding.
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
});
