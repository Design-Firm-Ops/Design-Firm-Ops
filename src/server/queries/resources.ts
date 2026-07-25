import { prisma } from '@/server/prisma';
import { storage } from '@/server/storage';

// The firm-wide resource library behind the Documents area.

export function listResourceFolders(firmId: string) {
  return prisma.resourceFolder.findMany({ where: { firmId } });
}

/**
 * Resource rows this viewer is allowed to see, each with a freshly-minted
 * signed URL. Admins see every folder; everyone else is filtered by that
 * folder's allow-list, where an empty list means "everyone".
 *
 * The filtering lives here rather than in the page so that a caller can't
 * render the list without applying it.
 */
export async function listVisibleResources({
  userId,
  isAdmin,
  firmId,
}: {
  userId: string;
  isAdmin: boolean;
  firmId: string;
}) {
  const [resources, folderPermissions] = await Promise.all([
    prisma.resource.findMany({ where: { firmId }, include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } }),
    listResourceFolders(firmId),
  ]);

  const restrictedFolders = new Set(
    folderPermissions
      .filter((folder) => folder.allowedUserIds.length > 0 && !folder.allowedUserIds.includes(userId))
      .map((folder) => folder.name)
  );

  const rows = await Promise.all(
    resources
      .filter((resource) => isAdmin || !restrictedFolders.has(resource.folder))
      .map(async (resource) => ({
        id: resource.id,
        folder: resource.folder,
        filename: resource.filename,
        url: await storage.createSignedUrl('resources', resource.storagePath),
        uploadedAt: resource.uploadedAt.toISOString(),
        uploadedByName: resource.uploadedBy?.name ?? null,
      }))
  );

  return { rows, folderPermissions };
}
