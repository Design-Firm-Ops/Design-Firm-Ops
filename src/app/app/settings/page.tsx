import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import SettingsForm from './SettingsForm';
import PermissionsManager from './PermissionsManager';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const admin = isAdmin(session);

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  let permissionsSection = null;
  if (admin) {
    const [designers, overrides] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'DESIGNER' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      prisma.userPermissionOverride.findMany(),
    ]);

    const overrideMap = Object.fromEntries(
      overrides.map((o) => [
        o.userId,
        {
          financials: o.financials,
          clientContact: o.clientContact,
          documentsPresentations: o.documentsPresentations,
          contracts: o.contracts,
          invoices: o.invoices,
          procurement: o.procurement,
          vendorCredentials: o.vendorCredentials,
        },
      ])
    );

    permissionsSection = (
      <PermissionsManager
        initialRoleDefaults={{
          designerCanViewFinancials: settings?.designerCanViewFinancials ?? false,
          designerCanViewClientContact: settings?.designerCanViewClientContact ?? true,
          designerCanViewDocumentsPresentations: settings?.designerCanViewDocumentsPresentations ?? true,
          designerCanViewContracts: settings?.designerCanViewContracts ?? true,
          designerCanViewInvoices: settings?.designerCanViewInvoices ?? true,
          designerCanViewProcurement: settings?.designerCanViewProcurement ?? true,
          designerCanViewVendorCredentials: settings?.designerCanViewVendorCredentials ?? false,
        }}
        designers={designers}
        initialOverrides={overrideMap}
      />
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-6 text-2xl font-medium text-brown">Company Settings</h1>
        <SettingsForm initialSettings={settings} />
      </div>

      {permissionsSection && (
        <div>
          <h2 className="mb-6 text-2xl font-medium text-brown">Permissions</h2>
          {permissionsSection}
        </div>
      )}
    </div>
  );
}
