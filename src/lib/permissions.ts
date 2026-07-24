import type { Session } from 'next-auth';

// The authorization *policy* — how a role, the firm-wide settings, and any
// per-user override combine into what someone can see. Deliberately pure: it
// takes data and returns flags, so it can be reasoned about and tested without
// a database. Loading those inputs is `@/server/permissions`.

/**
 * Resolved, ready-to-render visibility flags for the current session.
 * ADMIN always sees everything; DESIGNER is gated by the toggles an
 * admin sets on Settings > Permissions (Settings.designerCanView*).
 */
export interface ResolvedPermissions {
  isAdmin: boolean;
  financials: boolean;
  clientContact: boolean;
  documentsPresentations: boolean;
  contracts: boolean;
  invoices: boolean;
  procurement: boolean;
  vendorCredentials: boolean;
}

/** The firm-wide Designer-role defaults, as stored on Settings. */
export interface PermissionSettings {
  designerCanViewFinancials: boolean;
  designerCanViewClientContact: boolean;
  designerCanViewDocumentsPresentations: boolean;
  designerCanViewContracts: boolean;
  designerCanViewInvoices: boolean;
  designerCanViewProcurement: boolean;
  designerCanViewVendorCredentials: boolean;
}

/** A per-user override. A field that is null/absent means "inherit the role default". */
export type PermissionOverride = Partial<Record<keyof Omit<ResolvedPermissions, 'isAdmin'>, boolean | null>>;

export const ADMIN_PERMISSIONS: ResolvedPermissions = {
  isAdmin: true,
  financials: true,
  clientContact: true,
  documentsPresentations: true,
  contracts: true,
  invoices: true,
  procurement: true,
  vendorCredentials: true,
};

// What a designer sees when the firm has never touched Settings > Permissions.
// Money and vendor logins are the two things hidden by default.
const DESIGNER_FALLBACK = {
  financials: false,
  clientContact: true,
  documentsPresentations: true,
  contracts: true,
  invoices: true,
  procurement: true,
  vendorCredentials: false,
} as const;

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === 'ADMIN';
}

/**
 * Combines role, firm settings, and any per-user override into final flags.
 * Precedence per field: user override → firm setting → built-in default.
 * A null override field means "inherit", not "deny".
 */
export function resolvePermissionFlags({
  isAdmin: admin,
  settings,
  override,
}: {
  isAdmin: boolean;
  settings: PermissionSettings | null;
  override: PermissionOverride | null;
}): ResolvedPermissions {
  if (admin) return { ...ADMIN_PERMISSIONS };

  return {
    isAdmin: false,
    financials: override?.financials ?? settings?.designerCanViewFinancials ?? DESIGNER_FALLBACK.financials,
    clientContact: override?.clientContact ?? settings?.designerCanViewClientContact ?? DESIGNER_FALLBACK.clientContact,
    documentsPresentations:
      override?.documentsPresentations ??
      settings?.designerCanViewDocumentsPresentations ??
      DESIGNER_FALLBACK.documentsPresentations,
    contracts: override?.contracts ?? settings?.designerCanViewContracts ?? DESIGNER_FALLBACK.contracts,
    invoices: override?.invoices ?? settings?.designerCanViewInvoices ?? DESIGNER_FALLBACK.invoices,
    procurement: override?.procurement ?? settings?.designerCanViewProcurement ?? DESIGNER_FALLBACK.procurement,
    vendorCredentials:
      override?.vendorCredentials ??
      settings?.designerCanViewVendorCredentials ??
      DESIGNER_FALLBACK.vendorCredentials,
  };
}
