import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { clientSchema } from '@/lib/validation';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' }, include: { contacts: { orderBy: { order: 'asc' } } } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, clientSchema);
  if (response) return response;

  const { contacts, ...rest } = data;

  const client = await prisma.client.create({
    data: {
      ...rest,
      contacts: contacts
        ? { create: contacts.map((c, order) => ({ name: c.name || null, email: c.email || null, phone: c.phone || null, order })) }
        : undefined,
    },
    include: { contacts: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json(client, { status: 201 });
}
