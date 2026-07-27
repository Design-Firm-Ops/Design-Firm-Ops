// Decides whether the tenant-isolation gate genuinely ran and passed.
//
// Pure so it can be unit-tested — this check is itself part of the security
// gate, and an earlier version got it wrong: it scraped the human-readable
// vitest summary and reported "no passing tests" on a run where all 45 passed.
// The lesson is in the shape of this module, not just the fix — read the
// machine-readable report, and test the decision.

/**
 * @param {object|null} report parsed vitest JSON report, or null if unreadable
 * @returns {{ ok: boolean, message: string }}
 */
export function verdictFor(report) {
  if (!report || typeof report !== 'object') {
    return { ok: false, message: 'The isolation report could not be read.' };
  }

  const failed = report.numFailedTests ?? 0;
  const passed = report.numPassedTests ?? 0;
  const pending = report.numPendingTests ?? 0;
  const total = report.numTotalTests ?? 0;

  if (failed > 0) {
    return { ok: false, message: `Tenant isolation is broken: ${failed} test(s) failed.` };
  }

  // A skipped gate reads exactly like a passing one — which is the whole
  // reason this check exists. Without a database the suite skips entirely, so
  // zero passing tests means it never actually ran.
  if (passed === 0) {
    return {
      ok: false,
      message:
        'The tenant-isolation suite did not run (0 passing tests). It is the correctness ' +
        'gate for multi-tenancy and must execute in CI — check DATABASE_URL.',
    };
  }

  if (pending > 0) {
    return { ok: false, message: `${pending} isolation test(s) were skipped; the gate must run in full.` };
  }

  return { ok: true, message: `Tenant-isolation gate ran and passed: ${passed}/${total} tests.` };
}
