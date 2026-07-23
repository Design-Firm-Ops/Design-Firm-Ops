import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { invoiceCreateSchema } from '@/lib/validation';
import { nextInvoiceNumber } from '@/lib/invoiceNumber';
import { resolvePermissions } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, type, itemIds, designFeeChargeIds, newDesignFeeCharges, shippingTotal, taxRate, taxBase, dueDate, notes } =
    parsed.data;

  const perms = await resolvePermissions(session);
  const allowed = type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return NextResponse.json({ error: 'You do not have permission to create this invoice' }, { status: 403 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (type === 'DESIGN_FEE') {
    if (designFeeChargeIds.length === 0 && newDesignFeeCharges.length === 0) {
      return NextResponse.json({ error: 'Select a charge or add a custom line item' }, { status: 400 });
    }
    const charges = await prisma.designFeeCharge.findMany({ where: { id: { in: designFeeChargeIds }, projectId } });
    if (charges.length !== designFeeChargeIds.length) {
      return NextResponse.json({ error: 'Some charges were not found on this project' }, { status: 400 });
    }
    const alreadyInvoiced = charges.filter((c) => c.invoiceId);
    if (alreadyInvoiced.length > 0) {
      return NextResponse.json(
        { error: `${alreadyInvoiced.length} of the selected charges are already on an invoice` },
        { status: 409 }
      );
    }

    const invoiceNumber = await nextInvoiceNumber(projectId, project.invoicePrefix, 'DESIGN_FEE');

    // Custom line items typed directly into the invoice form are
    // auto-billed here — creating the invoice is what bills them, no
    // separate "Bill Design Fee" step required.
    const createdCharges = await Promise.all(
      newDesignFeeCharges.map((line) =>
        prisma.designFeeCharge.create({ data: { projectId, description: line.description, amount: line.amount } })
      )
    );
    const allChargeIds = [...designFeeChargeIds, ...createdCharges.map((c) => c.id)];

    const invoice = await prisma.invoice.create({
      data: {
        projectId,
        invoiceNumber,
        type: 'DESIGN_FEE',
        shippingTotal,
        taxRate: taxRate ?? 0,
        taxBase: taxBase ?? 'MERCH_ONLY',
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        designFeeCharges: { connect: allChargeIds.map((id) => ({ id })) },
      },
      include: { designFeeCharges: true },
    });

    return NextResponse.json(invoice, { status: 201 });
  }

  if (itemIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one item' }, { status: 400 });
  }

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

  const invoiceNumber = await nextInvoiceNumber(projectId, project.invoicePrefix, 'PROCUREMENT');

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      invoiceNumber,
      type: 'PROCUREMENT',
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
