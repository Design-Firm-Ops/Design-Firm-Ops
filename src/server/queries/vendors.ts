import { prisma } from '@/server/prisma';

// Vendor reads. Callers ask a question ("the vendor list") and get rows; they
// don't compose selects.

// The encrypted password is selected only so we can report *whether* one exists
// — it is never returned to a caller. See `toVendorRow`.
const VENDOR_FIELDS = {
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
} as const;

type VendorRecord = Awaited<ReturnType<typeof prisma.vendor.findFirstOrThrow<{ select: typeof VENDOR_FIELDS }>>>;

/**
 * Strips the encrypted trade-account password and applies credential
 * visibility. Doing it here rather than in each page means a caller cannot
 * forget and leak a vendor login to a designer who shouldn't see it.
 */
function toVendorRow({ tradeAccountPasswordEncrypted, ...vendor }: VendorRecord, canViewCredentials: boolean) {
  return {
    ...vendor,
    tradeAccountUsername: canViewCredentials ? vendor.tradeAccountUsername : null,
    tradeAccountNotes: canViewCredentials ? vendor.tradeAccountNotes : null,
    hasTradeAccountPassword: canViewCredentials && tradeAccountPasswordEncrypted !== null,
  };
}

export async function listVendors(canViewCredentials: boolean) {
  const vendors = await prisma.vendor.findMany({ select: VENDOR_FIELDS, orderBy: { name: 'asc' } });
  return vendors.map((vendor) => toVendorRow(vendor, canViewCredentials));
}

export async function getVendor(id: string, canViewCredentials: boolean) {
  const vendor = await prisma.vendor.findUnique({ where: { id }, select: VENDOR_FIELDS });
  return vendor ? toVendorRow(vendor, canViewCredentials) : null;
}

export function listOfferings() {
  return prisma.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
}

export function listItemTypeOptions() {
  return prisma.itemTypeOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
}
