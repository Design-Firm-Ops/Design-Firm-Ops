import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getSettings, listDesigners, listPermissionOverrides, listUsers } from '@/server/queries/settings';
import { isAdmin } from '@/lib/permissions';
import { requireFirmId } from '@/lib/tenant';
import SettingsForm from './SettingsForm';
import PermissionsManager from './PermissionsManager';
import UsersManager from './UsersManager';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const admin = isAdmin(session);
  const firmId = requireFirmId(session);

  const settings = await getSettings(firmId);

  let usersSection = null;
  let permissionsSection = null;
  if (admin) {
    const [allUsers, designers, overrides] = await Promise.all([
      listUsers(firmId),
      listDesigners(firmId),
      listPermissionOverrides(firmId),
    ]);

    usersSection = (
      <UsersManager
        initialUsers={allUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={session!.user.id}
      />
    );

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

      {usersSection && (
        <div>
          <h2 className="mb-6 text-2xl font-medium text-brown">Users</h2>
          {usersSection}
        </div>
      )}

      {permissionsSection && (
        <div>
          <h2 className="mb-6 text-2xl font-medium text-brown">Permissions</h2>
          {permissionsSection}
        </div>
      )}
    </div>
  );
}
