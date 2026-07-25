import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { forbidden, ok, parseBody } from '@/lib/apiRoute';
import { vendorSchema } from '@/lib/validation';
import { resolvePermissions } from '@/server/permissions';
import { encryptSecret } from '@/lib/crypto';

const VENDOR_SELECT = {
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
  offerings: { select: { id: true, name: true }, orderBy: { name: 'asc' as const } },
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const { data, response } = await parseBody(req, vendorSchema.partial());
  if (response) return response;

  const { tradeAccountPassword, offerings, ...rest } = data;

  const hasCredentialInput =
    tradeAccountPassword !== undefined || rest.tradeAccountUsername !== undefined || rest.tradeAccountNotes !== undefined;
  const perms = await resolvePermissions(session);
  if (hasCredentialInput && !perms.vendorCredentials) {
    return forbidden('You do not have permission to change trade account credentials');
  }

  const vendor = await db.vendor.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(offerings ? { offerings: { set: offerings.map((id) => ({ id })) } } : {}),
      ...(tradeAccountPassword ? { tradeAccountPasswordEncrypted: encryptSecret(tradeAccountPassword) } : {}),
    },
    select: VENDOR_SELECT,
  });
  return NextResponse.json(toClientVendor(vendor, perms.vendorCredentials));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const db = getTenantDb(session);

  const itemCount = await db.item.count({ where: { vendorId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this vendor is referenced by ${itemCount} line item(s).` },
      { status: 409 }
    );
  }

  await db.vendor.delete({ where: { id: params.id } });
  return ok();
}
