import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { conflict, forbidden, notFound, parseBody } from '@/lib/apiRoute';
import { resolvePermissions } from '@/lib/permissions';
import { invoiceUpdateSchema } from '@/lib/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { items: true } });
  if (!invoice) return notFound();
  return NextResponse.json(invoice);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const perms = await resolvePermissions(session);
  const allowed = existing.type === 'DESIGN_FEE' ? perms.financials : perms.invoices;
  if (!allowed) {
    return forbidden('You do not have permission to edit this invoice');
  }

  if (existing.status === 'VOID') {
    return conflict('This invoice has been voided and can no longer be edited');
  }

  const { data, response } = await parseBody(req, invoiceUpdateSchema);
  if (response) return response;

  const { dueDate, columnConfig, ...rest } = data;

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(columnConfig !== undefined ? { columnConfig: columnConfig === null ? Prisma.JsonNull : columnConfig } : {}),
    },
  });
  return NextResponse.json(invoice);
}
