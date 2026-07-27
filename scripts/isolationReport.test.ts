import { describe, it, expect } from 'vitest';
import { verdictFor } from './isolationReport.mjs';

// This check is part of the security gate, so it gets tested like one. An
// earlier version scraped vitest's printed summary and reported "no passing
// tests" on a run where all 45 passed — a gate that mis-reads its own result
// is worse than no gate, because it erodes trust in the real signal.

const green = { numTotalTests: 45, numPassedTests: 45, numFailedTests: 0, numPendingTests: 0 };

describe('verdictFor', () => {
  it('passes a fully green run', () => {
    const v = verdictFor(green);
    expect(v.ok).toBe(true);
    expect(v.message).toContain('45/45');
  });

  it('fails when isolation is broken', () => {
    const v = verdictFor({ ...green, numPassedTests: 6, numFailedTests: 39 });
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/isolation is broken: 39/);
  });

  // The silent hole this check exists for: without a database the suite skips
  // entirely, and a skipped gate looks exactly like a passing one.
  it('fails when the suite never ran', () => {
    const v = verdictFor({ numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0 });
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/did not run/);
    expect(v.message).toMatch(/DATABASE_URL/);
  });

  it('fails when only some tests were skipped', () => {
    const v = verdictFor({ ...green, numPassedTests: 40, numPendingTests: 5 });
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/5 isolation test\(s\) were skipped/);
  });

  it('fails when the report is missing or unreadable', () => {
    for (const bad of [null, undefined, 'not an object', 42]) {
      expect(verdictFor(bad as never).ok).toBe(false);
    }
  });

  // Failures outrank everything: a run that is both broken and partly skipped
  // must report the breakage, not the skip.
  it('reports breakage ahead of skips', () => {
    const v = verdictFor({ numTotalTests: 45, numPassedTests: 40, numFailedTests: 3, numPendingTests: 2 });
    expect(v.message).toMatch(/isolation is broken/);
  });

  it('tolerates a report missing some counters', () => {
    expect(verdictFor({ numPassedTests: 45 }).ok).toBe(true);
    expect(verdictFor({}).ok).toBe(false);
  });
});
