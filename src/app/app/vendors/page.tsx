import { getServerSession } from 'next-auth';
import { requireFirmId } from '@/lib/tenant';
import { authOptions } from '@/server/auth';
import { listOfferings, listVendors } from '@/server/queries/vendors';
import { resolvePermissions } from '@/server/permissions';
import VendorsManager from './VendorsManager';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const session = await getServerSession(authOptions);
  const firmId = requireFirmId(session);
  const perms = await resolvePermissions(session);

  const [vendors, offerings] = await Promise.all([
    listVendors(firmId, perms.vendorCredentials),
    listOfferings(firmId),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-brown">Vendors</h1>
      <VendorsManager
        initialVendors={vendors}
        offeringOptions={offerings.map((o) => ({ id: o.id, name: o.name }))}
        canViewCredentials={perms.vendorCredentials}
      />
    </div>
  );
}
