import { describe, it, expect } from 'vitest';
import { isAdmin, resolvePermissionFlags, ADMIN_PERMISSIONS, type PermissionSettings } from '@/lib/permissions';

// The point of splitting the policy out of the loader: this whole file runs
// with no database, no session provider, and no mocking.

const allOff: PermissionSettings = {
  designerCanViewFinancials: false,
  designerCanViewClientContact: false,
  designerCanViewDocumentsPresentations: false,
  designerCanViewContracts: false,
  designerCanViewInvoices: false,
  designerCanViewProcurement: false,
  designerCanViewVendorCredentials: false,
};

describe('isAdmin', () => {
  it('is true only for the ADMIN role', () => {
    expect(isAdmin({ user: { role: 'ADMIN' } } as never)).toBe(true);
    expect(isAdmin({ user: { role: 'DESIGNER' } } as never)).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin({} as never)).toBe(false);
  });
});

describe('resolvePermissionFlags', () => {
  it('gives an admin everything regardless of settings', () => {
    expect(resolvePermissionFlags({ isAdmin: true, settings: allOff, override: null })).toEqual(ADMIN_PERMISSIONS);
  });

  it('falls back to the built-in designer defaults when nothing is configured', () => {
    const flags = resolvePermissionFlags({ isAdmin: false, settings: null, override: null });
    // Financials and vendor credentials are the two that default to hidden.
    expect(flags.financials).toBe(false);
    expect(flags.vendorCredentials).toBe(false);
    expect(flags.clientContact).toBe(true);
    expect(flags.procurement).toBe(true);
    expect(flags.isAdmin).toBe(false);
  });

  it('applies the role-level settings for a designer', () => {
    const flags = resolvePermissionFlags({
      isAdmin: false,
      settings: { ...allOff, designerCanViewFinancials: true },
      override: null,
    });
    expect(flags.financials).toBe(true);
    expect(flags.procurement).toBe(false);
  });

  it('lets a per-user override win over the role setting', () => {
    const flags = resolvePermissionFlags({
      isAdmin: false,
      settings: { ...allOff, designerCanViewFinancials: false },
      override: { financials: true },
    });
    expect(flags.financials).toBe(true);
  });

  // The subtle rule: null on an override field means "inherit", not "deny".
  it('treats a null override field as inherit, not deny', () => {
    const flags = resolvePermissionFlags({
      isAdmin: false,
      settings: { ...allOff, designerCanViewProcurement: true },
      override: { procurement: null, financials: true },
    });
    expect(flags.procurement).toBe(true);
    expect(flags.financials).toBe(true);
  });

  it('lets an override deny something the role setting allows', () => {
    const flags = resolvePermissionFlags({
      isAdmin: false,
      settings: { ...allOff, designerCanViewInvoices: true },
      override: { invoices: false },
    });
    expect(flags.invoices).toBe(false);
  });

  it('never reports isAdmin for a designer, however permissive the settings', () => {
    const flags = resolvePermissionFlags({
      isAdmin: false,
      settings: {
        designerCanViewFinancials: true,
        designerCanViewClientContact: true,
        designerCanViewDocumentsPresentations: true,
        designerCanViewContracts: true,
        designerCanViewInvoices: true,
        designerCanViewProcurement: true,
        designerCanViewVendorCredentials: true,
      },
      override: null,
    });
    expect(flags.isAdmin).toBe(false);
  });
});
