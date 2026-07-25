import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { requireSession } from '@/server/apiAuth';
import { parseBody } from '@/lib/apiRoute';
import { clientSchema } from '@/lib/validation';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const clients = await db.client.findMany({ orderBy: { name: 'asc' }, include: { contacts: { orderBy: { order: 'asc' } } } });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const { data, response } = await parseBody(req, clientSchema);
  if (response) return response;

  const { contacts, ...rest } = data;

  const client = await db.client.create({
    data: {
      ...rest,
      firmId: firmId,
      contacts: contacts
        ? { create: contacts.map((c, order) => ({ name: c.name || null, email: c.email || null, phone: c.phone || null, order, firmId })) }
        : undefined,
    },
    include: { contacts: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json(client, { status: 201 });
}
