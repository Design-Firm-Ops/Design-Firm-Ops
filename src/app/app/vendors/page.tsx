import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolvePermissions } from '@/lib/permissions';
import VendorsManager from './VendorsManager';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);

  const [vendorsRaw, offerings] = await Promise.all([
    prisma.vendor.findMany({
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
        offerings: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        notes: true,
        accountNumber: true,
        tradeAccountUsername: true,
        tradeAccountPasswordEncrypted: true,
        tradeAccountNotes: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
  ]);

  const vendors = vendorsRaw.map(({ tradeAccountPasswordEncrypted, ...v }) => ({
    ...v,
    tradeAccountUsername: perms.vendorCredentials ? v.tradeAccountUsername : null,
    tradeAccountNotes: perms.vendorCredentials ? v.tradeAccountNotes : null,
    hasTradeAccountPassword: perms.vendorCredentials && tradeAccountPasswordEncrypted !== null,
  }));

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
