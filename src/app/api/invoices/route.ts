import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { badRequest, forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { invoiceCreateSchema } from '@/lib/validation';
import { nextInvoiceNumber } from '@/server/invoiceNumber';
import { resolvePermissions } from '@/server/permissions';

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, invoiceCreateSchema);
  if (response) return response;

  const { projectId, type, itemIds, designFeeChargeIds, newDesignFeeCharges, shippingTotal, taxRate, taxBase, dueDate, notes } =
    data;

  const perms = await resolvePermissions(session);
  const allowed = type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to create this invoice');
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return notFound('Project not found');

  if (type === 'DESIGN_FEE') {
    if (designFeeChargeIds.length === 0 && newDesignFeeCharges.length === 0) {
      return badRequest('Select a charge or add a custom line item');
    }
    const charges = await prisma.designFeeCharge.findMany({ where: { id: { in: designFeeChargeIds }, projectId } });
    if (charges.length !== designFeeChargeIds.length) {
      return badRequest('Some charges were not found on this project');
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
    return badRequest('Select at least one item');
  }

  const items = await prisma.item.findMany({ where: { id: { in: itemIds }, projectId } });
  if (items.length !== itemIds.length) {
    return badRequest('Some items were not found on this project');
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
