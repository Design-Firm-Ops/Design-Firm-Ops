import { prisma } from '@/lib/prisma';
import VendorsManager from './VendorsManager';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Vendors</h1>
      <VendorsManager initialVendors={vendors} />
    </div>
  );
}
