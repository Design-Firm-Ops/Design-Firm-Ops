import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { listVisibleResources } from '@/server/queries/resources';
import { listUsers } from '@/server/queries/settings';
import { isAdmin } from '@/lib/permissions';
import AdminBrowser from './AdminBrowser';

export const dynamic = 'force-dynamic';

export default async function AdministrationPage() {
  const session = await getServerSession(authOptions);
  const admin = isAdmin(session);
  const currentUserId = session!.user.id;

  const [{ rows: resourceRows, folderPermissions }, users] = await Promise.all([
    listVisibleResources({ userId: currentUserId, isAdmin: admin }),
    listUsers(),
  ]);

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
