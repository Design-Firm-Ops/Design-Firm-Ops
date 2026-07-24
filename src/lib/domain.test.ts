import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_TYPES,
  INVOICE_TYPES,
  PROJECT_STATUSES,
  isDocumentType,
  isProjectStatus,
} from '@/lib/domain';

// These guards are used as input validation at API boundaries, so the
// rejection cases matter more than the acceptance ones.

describe('isDocumentType', () => {
  it('accepts every declared document type', () => {
    for (const type of DOCUMENT_TYPES) expect(isDocumentType(type)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const value of ['contract', 'CONTRACTS', '', 'DROP TABLE', null, undefined, 42, {}, ['CONTRACT']]) {
      expect(isDocumentType(value)).toBe(false);
    }
  });
});

describe('isProjectStatus', () => {
  it('accepts every declared project status', () => {
    for (const status of PROJECT_STATUSES) expect(isProjectStatus(status)).toBe(true);
  });

  it('rejects anything else, including the "ALL" filter sentinel', () => {
    // "ALL" is a UI filter value, deliberately not a stored status.
    for (const value of ['ALL', 'active', '', null, undefined, 0, {}]) {
      expect(isProjectStatus(value)).toBe(false);
    }
  });
});

describe('domain vocabularies', () => {
  it('keeps invoice types to the two the pricing rules distinguish', () => {
    expect([...INVOICE_TYPES]).toEqual(['PROCUREMENT', 'DESIGN_FEE']);
  });

  it('has no duplicate members in any vocabulary', () => {
    for (const list of [DOCUMENT_TYPES, INVOICE_TYPES, PROJECT_STATUSES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
