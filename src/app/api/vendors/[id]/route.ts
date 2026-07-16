import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { vendorSchema } from '@/lib/validation';
import { resolvePermissions } from '@/lib/permissions';
import { encryptSecret } from '@/lib/crypto';

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = vendorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tradeAccountPassword, ...rest } = parsed.data;

  const hasCredentialInput =
    tradeAccountPassword !== undefined || rest.tradeAccountUsername !== undefined || rest.tradeAccountNotes !== undefined;
  const perms = await resolvePermissions(session);
  if (hasCredentialInput && !perms.vendorCredentials) {
    return NextResponse.json({ error: 'You do not have permission to change trade account credentials' }, { status: 403 });
  }

  const vendor = await prisma.vendor.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(tradeAccountPassword ? { tradeAccountPasswordEncrypted: encryptSecret(tradeAccountPassword) } : {}),
    },
    select: VENDOR_SELECT,
  });
  return NextResponse.json(toClientVendor(vendor, perms.vendorCredentials));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const itemCount = await prisma.item.count({ where: { vendorId: params.id } });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this vendor is referenced by ${itemCount} line item(s).` },
      { status: 409 }
    );
  }

  await prisma.vendor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
