import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { vendorSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { encryptSecret } from '@/lib/crypto';

// tradeAccountPasswordEncrypted is selected only to derive the
// hasTradeAccountPassword flag below — the ciphertext itself is never
// sent to the client. Credentials are only ever read in full through
// the dedicated /api/vendors/[id]/credentials endpoint, which checks
// permission before decrypting.
const VENDOR_SELECT = {
  id: true,
  name: true,
  website: true,
  showroomRep: true,
  accountType: true,
  productType: true,
  priceRange: true,
  offerings: true,
  notes: true,
  accountNumber: true,
  tradeAccountUsername: true,
  tradeAccountPasswordEncrypted: true,
  tradeAccountNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

type RawVendor = {
  tradeAccountUsername: string | null;
  tradeAccountPasswordEncrypted: string | null;
  tradeAccountNotes: string | null;
};

function toClientVendor<T extends RawVendor>(vendor: T, canView: boolean) {
  const { tradeAccountPasswordEncrypted, ...rest } = vendor;
  const hasTradeAccountPassword = tradeAccountPasswordEncrypted !== null;
  if (canView) return { ...rest, hasTradeAccountPassword };
  return { ...rest, tradeAccountUsername: null, tradeAccountNotes: null, hasTradeAccountPassword: false };
}

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  const vendors = await prisma.vendor.findMany({ select: VENDOR_SELECT, orderBy: { name: 'asc' } });
  return NextResponse.json(vendors.map((v) => toClientVendor(v, perms.vendorCredentials)));
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = vendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tradeAccountPassword, ...rest } = parsed.data;

  const hasCredentialInput = !!(tradeAccountPassword || rest.tradeAccountUsername || rest.tradeAccountNotes);
  if (hasCredentialInput) {
    const perms = await resolvePermissions(session);
    if (!perms.vendorCredentials) {
      return NextResponse.json({ error: 'You do not have permission to set trade account credentials' }, { status: 403 });
    }
  }

  const vendor = await prisma.vendor.create({
    data: {
      ...rest,
      tradeAccountPasswordEncrypted: tradeAccountPassword ? encryptSecret(tradeAccountPassword) : null,
    },
    select: VENDOR_SELECT,
  });
  const perms = await resolvePermissions(session);
  return NextResponse.json(toClientVendor(vendor, perms.vendorCredentials));
}
