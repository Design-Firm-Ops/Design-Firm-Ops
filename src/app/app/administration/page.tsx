import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSignedResourceUrl } from '@/lib/supabase';
import { isAdmin } from '@/lib/permissions';
import AdminBrowser from './AdminBrowser';

export const dynamic = 'force-dynamic';

export default async function AdministrationPage() {
  const session = await getServerSession(authOptions);
  const admin = isAdmin(session);
  const currentUserId = session!.user.id;

  const [resources, folderPermissions, users] = await Promise.all([
    prisma.resource.findMany({ include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } }),
    prisma.resourceFolder.findMany(),
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-brown">Documents</h1>
      <AdminBrowser
        resourceRows={resourceRows}
        allUsers={admin ? users.map((u) => ({ id: u.id, name: u.name, email: u.email })) : []}
        folderPermissions={folderPermissions.map((f) => ({ name: f.name, allowedUserIds: f.allowedUserIds }))}
        isAdmin={admin}
      />
    </div>
  );
}
