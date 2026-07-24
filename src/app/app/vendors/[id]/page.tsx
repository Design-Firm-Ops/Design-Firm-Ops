import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getVendor, listItemTypeOptions, listOfferings } from '@/server/queries/vendors';
import { listActiveProjects } from '@/server/queries/projects';
import { resolvePermissions } from '@/server/permissions';
import VendorDetailTabs from './VendorDetailTabs';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);

  const [vendor, offerings, itemTypeOptions, activeProjects] = await Promise.all([
    getVendor(params.id, perms.vendorCredentials),
    listOfferings(),
    listItemTypeOptions(),
    listActiveProjects(),
  ]);

  if (!vendor) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-brown">{vendor.name}</h1>
      <VendorDetailTabs
        vendor={vendor}
        offeringOptions={offerings.map((o) => ({ id: o.id, name: o.name }))}
        itemTypeOptions={itemTypeOptions.map((t) => ({ id: t.id, category: t.category, name: t.name }))}
        activeProjects={activeProjects}
        canViewCredentials={perms.vendorCredentials}
      />
    </div>
  );
}
