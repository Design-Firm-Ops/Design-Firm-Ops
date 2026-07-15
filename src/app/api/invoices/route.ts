import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { invoiceCreateSchema } from '@/lib/validation';
import { nextInvoiceNumber } from '@/lib/invoiceNumber';

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, itemIds, shippingTotal, taxRate, taxBase, dueDate, notes } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const items = await prisma.item.findMany({ where: { id: { in: itemIds }, projectId } });
  if (items.length !== itemIds.length) {
    return NextResponse.json({ error: 'Some items were not found on this project' }, { status: 400 });
  }
  const alreadyInvoiced = items.filter((i) => i.invoiceId);
  if (alreadyInvoiced.length > 0) {
    return NextResponse.json(
      { error: `${alreadyInvoiced.length} of the selected items are already on an invoice` },
      { status: 409 }
    );
  }

  const invoiceNumber = await nextInvoiceNumber(projectId, project.invoicePrefix);

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      invoiceNumber,
      shippingTotal,
      taxRate: taxRate ?? project.salesTaxRate,
      taxBase: taxBase ?? project.taxBase,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      items: { connect: itemIds.map((id) => ({ id })) },
    },
    include: { items: true },
  });

  await prisma.item.updateMany({
    where: { id: { in: itemIds } },
    data: { status: 'INVOICED' },
  });

  return NextResponse.json(invoice, { status: 201 });
}
