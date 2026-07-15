import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { vendorSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = vendorSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const vendor = await prisma.vendor.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(vendor);
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
