import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

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

export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === 'ADMIN';
}

export async function resolvePermissions(session: Session | null): Promise<ResolvedPermissions> {
  if (isAdmin(session)) {
    return {
      isAdmin: true,
      financials: true,
      clientContact: true,
      documentsPresentations: true,
      contracts: true,
      invoices: true,
      procurement: true,
      vendorCredentials: true,
    };
  }

  const [settings, override] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    session?.user?.id
      ? prisma.userPermissionOverride.findUnique({ where: { userId: session.user.id } })
      : Promise.resolve(null),
  ]);

  // A per-user override (set on Settings > Permissions) wins when
  // present; null on any field falls back to the Designer role default.
  return {
    isAdmin: false,
    financials: override?.financials ?? settings?.designerCanViewFinancials ?? false,
    clientContact: override?.clientContact ?? settings?.designerCanViewClientContact ?? true,
    documentsPresentations:
      override?.documentsPresentations ?? settings?.designerCanViewDocumentsPresentations ?? true,
    contracts: override?.contracts ?? settings?.designerCanViewContracts ?? true,
    invoices: override?.invoices ?? settings?.designerCanViewInvoices ?? true,
    procurement: override?.procurement ?? settings?.designerCanViewProcurement ?? true,
    vendorCredentials: override?.vendorCredentials ?? settings?.designerCanViewVendorCredentials ?? false,
  };
}
