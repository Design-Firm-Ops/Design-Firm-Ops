import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolvePermissions } from '@/lib/permissions';
import VendorsManager from './VendorsManager';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);

  const vendorsRaw = await prisma.vendor.findMany({
    select: {
      id: true,
      name: true,
      website: true,
      repName: true,
      repEmail: true,
      repPhone: true,
      showroomName: true,
      showroomAddress: true,
      accountType: true,
      productType: true,
      priceRange: true,
      offerings: true,
      notes: true,
      accountNumber: true,
      tradeAccountUsername: true,
      tradeAccountPasswordEncrypted: true,
      tradeAccountNotes: true,
    },
    orderBy: { name: 'asc' },
  });

  const vendors = vendorsRaw.map(({ tradeAccountPasswordEncrypted, ...v }) => ({
    ...v,
    tradeAccountUsername: perms.vendorCredentials ? v.tradeAccountUsername : null,
    tradeAccountNotes: perms.vendorCredentials ? v.tradeAccountNotes : null,
    hasTradeAccountPassword: perms.vendorCredentials && tradeAccountPasswordEncrypted !== null,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Vendors</h1>
      <VendorsManager initialVendors={vendors} canViewCredentials={perms.vendorCredentials} />
    </div>
  );
}
