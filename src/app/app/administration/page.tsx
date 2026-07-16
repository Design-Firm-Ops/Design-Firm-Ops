import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSignedResourceUrl } from '@/lib/supabase';
import { isAdmin } from '@/lib/permissions';
import AdminBrowser from './AdminBrowser';
import UsersManager from './UsersManager';
import PermissionsForm from './PermissionsForm';

export const dynamic = 'force-dynamic';

export default async function AdministrationPage() {
  const session = await getServerSession(authOptions);
  const admin = isAdmin(session);

  const [resources, settings, users] = await Promise.all([
    prisma.resource.findMany({ include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } }),
    admin ? prisma.settings.findUnique({ where: { id: 1 } }) : Promise.resolve(null),
    admin
      ? prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const resourceRows = await Promise.all(
    resources.map(async (r) => ({
      id: r.id,
      folder: r.folder,
      filename: r.filename,
      url: await createSignedResourceUrl(r.storagePath),
      uploadedAt: r.uploadedAt.toISOString(),
      uploadedByName: r.uploadedBy?.name ?? null,
    }))
  );

  const usersTab = admin ? (
    <UsersManager
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      currentUserId={session!.user.id}
    />
  ) : null;
  const permissionsTab = admin ? (
    <PermissionsForm
      initialSettings={{
        designerCanViewFinancials: settings?.designerCanViewFinancials ?? false,
        designerCanViewClientContact: settings?.designerCanViewClientContact ?? true,
        designerCanViewDocumentsPresentations: settings?.designerCanViewDocumentsPresentations ?? true,
        designerCanViewContracts: settings?.designerCanViewContracts ?? true,
        designerCanViewInvoices: settings?.designerCanViewInvoices ?? true,
        designerCanViewProcurement: settings?.designerCanViewProcurement ?? true,
        designerCanViewVendorCredentials: settings?.designerCanViewVendorCredentials ?? false,
      }}
    />
  ) : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Administration</h1>
      <AdminBrowser
        resourceRows={resourceRows}
        usersForSearch={users.map((u) => ({ name: u.name, email: u.email }))}
        usersContent={usersTab}
        permissionsContent={permissionsTab}
        isAdmin={admin}
      />
    </div>
  );
}
