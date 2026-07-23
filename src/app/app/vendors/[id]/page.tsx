import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolvePermissions } from '@/lib/permissions';
import VendorDetailTabs from './VendorDetailTabs';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);

  const [vendorRaw, offerings, itemTypeOptions, activeProjects] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: params.id },
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
    }),
    prisma.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemTypeOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.project.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!vendorRaw) notFound();

  const { tradeAccountPasswordEncrypted, ...rest } = vendorRaw;
  const vendor = {
    ...rest,
    tradeAccountUsername: perms.vendorCredentials ? rest.tradeAccountUsername : null,
    tradeAccountNotes: perms.vendorCredentials ? rest.tradeAccountNotes : null,
    hasTradeAccountPassword: perms.vendorCredentials && tradeAccountPasswordEncrypted !== null,
  };

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
