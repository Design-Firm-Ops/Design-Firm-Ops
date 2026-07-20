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
  const currentUserId = session!.user.id;

  const [resources, folderPermissions, settings, users] = await Promise.all([
    prisma.resource.findMany({ include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } }),
    prisma.resourceFolder.findMany(),
    admin ? prisma.settings.findUnique({ where: { id: 1 } }) : Promise.resolve(null),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Admins always see every folder; everyone else is filtered by that
  // folder's allow-list (an empty list means "everyone can see it").
  const restrictedFolders = new Set(
    folderPermissions
      .filter((f) => f.allowedUserIds.length > 0 && !f.allowedUserIds.includes(currentUserId))
      .map((f) => f.name)
  );

  const resourceRows = await Promise.all(
    resources
      .filter((r) => admin || !restrictedFolders.has(r.folder))
      .map(async (r) => ({
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
      currentUserId={currentUserId}
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
        allUsers={admin ? users.map((u) => ({ id: u.id, name: u.name, email: u.email })) : []}
        folderPermissions={folderPermissions.map((f) => ({ name: f.name, allowedUserIds: f.allowedUserIds }))}
        usersContent={usersTab}
        permissionsContent={permissionsTab}
        isAdmin={admin}
      />
    </div>
  );
}
