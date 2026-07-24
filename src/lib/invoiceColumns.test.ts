import { describe, it, expect } from 'vitest';
import {
  INVOICE_COLUMNS,
  COLUMN_LABELS,
  COLUMN_PRESETS,
  resolveColumnConfig,
  type InvoiceColumnConfig,
} from '@/lib/invoiceColumns';

// This module decides what a *client* sees on their invoice, so the tests are
// about confidentiality as much as correctness.

describe('INVOICE_COLUMNS', () => {
  // The module's premise: internal-only fields aren't in the list at all, so
  // no config — however malformed or hand-edited — can surface them.
  it('offers no column that would expose internal data', () => {
    const forbidden = ['vendor', 'vendorName', 'notes', 'internalNotes', 'cost', 'profit', 'margin', 'markupPct'];
    for (const key of forbidden) {
      expect(INVOICE_COLUMNS as readonly string[]).not.toContain(key);
    }
  });

  it('labels every column it offers', () => {
    for (const column of INVOICE_COLUMNS) {
      expect(COLUMN_LABELS[column]).toBeTruthy();
    }
    expect(Object.keys(COLUMN_LABELS)).toHaveLength(INVOICE_COLUMNS.length);
  });

  it('only uses known columns in every preset', () => {
    for (const [name, preset] of Object.entries(COLUMN_PRESETS)) {
      expect(preset.label, `${name} needs a label`).toBeTruthy();
      for (const column of preset.config.columns) {
        expect(INVOICE_COLUMNS as readonly string[], `${name} uses an unknown column`).toContain(column);
      }
    }
  });

  // The distinction the presets exist to make.
  it('excludes unit cost from every preset except the transparent one', () => {
    expect(COLUMN_PRESETS.transparent.config.columns).toContain('unitCost');
    expect(COLUMN_PRESETS.priceOnly.config.columns).not.toContain('unitCost');
    expect(COLUMN_PRESETS.minimal.config.columns).not.toContain('unitCost');
  });
});

describe('resolveColumnConfig', () => {
  const invoiceConfig: InvoiceColumnConfig = { columns: ['description', 'extended'] };
  const projectConfig: InvoiceColumnConfig = { columns: ['tag', 'description', 'qty'] };

  it('prefers the invoice override over everything', () => {
    expect(resolveColumnConfig(invoiceConfig, projectConfig)).toEqual(invoiceConfig);
  });

  it('falls back to the project default when the invoice has none', () => {
    expect(resolveColumnConfig(null, projectConfig)).toEqual(projectConfig);
    expect(resolveColumnConfig(undefined, projectConfig)).toEqual(projectConfig);
  });

  it('falls back to the built-in default when neither is set', () => {
    expect(resolveColumnConfig(null)).toEqual(COLUMN_PRESETS.transparent.config);
    expect(resolveColumnConfig(undefined, undefined)).toEqual(COLUMN_PRESETS.transparent.config);
  });

  // A config is stored as free-form JSON, so anything could be in that column.
  it('rejects a malformed invoice config and moves down the chain', () => {
    for (const malformed of [{}, { columns: 'nope' }, { columns: {} }, 'string', 42, [], true]) {
      expect(resolveColumnConfig(malformed, projectConfig)).toEqual(projectConfig);
    }
  });

  it('rejects a config containing an unknown column key', () => {
    // The important case: a column that would leak cost/vendor data invalidates
    // the whole config rather than being silently passed through.
    expect(resolveColumnConfig({ columns: ['description', 'vendorName'] }, projectConfig)).toEqual(projectConfig);
    expect(resolveColumnConfig({ columns: ['profit'] }, undefined)).toEqual(COLUMN_PRESETS.transparent.config);
  });

  it('falls all the way through when both configs are malformed', () => {
    expect(resolveColumnConfig({ columns: ['bogus'] }, { columns: ['alsoBogus'] })).toEqual(
      COLUMN_PRESETS.transparent.config
    );
  });

  it('accepts an empty column list as a deliberate choice', () => {
    expect(resolveColumnConfig({ columns: [] }, projectConfig)).toEqual({ columns: [] });
  });
});
