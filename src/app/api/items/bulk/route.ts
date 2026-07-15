import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['delete', 'setStatus']),
  status: z.enum(['PROPOSED', 'APPROVED', 'INVOICED', 'ORDERED', 'RECEIVED', 'DELIVERED']).optional(),
});

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids, action, status } = parsed.data;

  if (action === 'delete') {
    await prisma.item.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'setStatus') {
    if (!status) {
      return NextResponse.json({ error: 'status is required for setStatus' }, { status: 400 });
    }
    await prisma.item.updateMany({ where: { id: { in: ids } }, data: { status } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
