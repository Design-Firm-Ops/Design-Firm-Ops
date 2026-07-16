import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

/**
 * Resolved, ready-to-render visibility flags for the current session.
 * ADMIN always sees everything; DESIGNER is gated by the toggles an
 * admin sets on Administration > Permissions (Settings.designerCanView*).
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

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return {
    isAdmin: false,
    financials: settings?.designerCanViewFinancials ?? false,
    clientContact: settings?.designerCanViewClientContact ?? true,
    documentsPresentations: settings?.designerCanViewDocumentsPresentations ?? true,
    contracts: settings?.designerCanViewContracts ?? true,
    invoices: settings?.designerCanViewInvoices ?? true,
    procurement: settings?.designerCanViewProcurement ?? true,
    vendorCredentials: settings?.designerCanViewVendorCredentials ?? false,
  };
}
