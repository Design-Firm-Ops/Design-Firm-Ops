import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { clientSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contacts, ...rest } = parsed.data;

  // Additional contacts are sent as the full current list — replace
  // all existing rows rather than trying to diff/reconcile individual
  // adds/edits/removes.
  const client = await prisma.$transaction(async (tx) => {
    if (contacts !== undefined) {
      await tx.clientContact.deleteMany({ where: { clientId: params.id } });
      if (contacts.length > 0) {
        await tx.clientContact.createMany({
          data: contacts.map((c, order) => ({
            clientId: params.id,
            name: c.name || null,
            email: c.email || null,
            phone: c.phone || null,
            order,
          })),
        });
      }
    }
    return tx.client.update({
      where: { id: params.id },
      data: rest,
      include: { contacts: { orderBy: { order: 'asc' } } },
    });
  });

  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const projectCount = await prisma.project.count({ where: { clientId: params.id } });
  if (projectCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this client has ${projectCount} project(s). Reassign or delete those first.` },
      { status: 409 }
    );
  }

  await prisma.client.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
