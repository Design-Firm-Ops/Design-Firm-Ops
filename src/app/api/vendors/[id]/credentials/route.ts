import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { resolvePermissions } from '@/lib/permissions';
import { decryptSecret } from '@/lib/crypto';

/** Returns decrypted trade-account credentials — permission-gated, never bundled into the general vendor list/detail response. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const perms = await resolvePermissions(session);
  if (!perms.vendorCredentials) {
    return NextResponse.json({ error: 'You do not have permission to view trade account credentials' }, { status: 403 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    select: { tradeAccountUsername: true, tradeAccountPasswordEncrypted: true, tradeAccountNotes: true },
  });
  if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let password: string | null = null;
  if (vendor.tradeAccountPasswordEncrypted) {
    try {
      password = decryptSecret(vendor.tradeAccountPasswordEncrypted);
    } catch {
      password = null;
    }
  }

  return NextResponse.json({
    username: vendor.tradeAccountUsername,
    password,
    notes: vendor.tradeAccountNotes,
  });
}
