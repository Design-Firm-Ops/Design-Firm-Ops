import type { Session } from 'next-auth';
import { prisma } from '@/server/prisma';
import { isAdmin, resolvePermissionFlags, ADMIN_PERMISSIONS, type ResolvedPermissions } from '@/lib/permissions';

// Loads the inputs the permission policy needs. The policy itself lives in
// `@/lib/permissions` and is pure — this is the only part that needs a database.

export { isAdmin } from '@/lib/permissions';
export type { ResolvedPermissions } from '@/lib/permissions';

export async function resolvePermissions(session: Session | null): Promise<ResolvedPermissions> {
  // An admin's answer doesn't depend on any stored setting, so don't pay for
  // the queries.
  if (isAdmin(session)) return { ...ADMIN_PERMISSIONS };

  const [settings, override] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 } }),
    session?.user?.id
      ? prisma.userPermissionOverride.findUnique({ where: { userId: session.user.id } })
      : Promise.resolve(null),
  ]);

  return resolvePermissionFlags({ isAdmin: false, settings, override });
}
