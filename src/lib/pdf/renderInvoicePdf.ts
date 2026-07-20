import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { resolveColumnConfig } from '@/lib/invoiceColumns';
import { InvoiceDocument } from './InvoiceDocument';

/** Fetches everything an invoice PDF needs and renders it to a Buffer. */
export async function renderInvoicePdf(invoiceId: string): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      project: { include: { client: true } },
    },
  });
  if (!invoice) return null;

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  const columnConfig = resolveColumnConfig(invoice.columnConfig, invoice.project.defaultInvoiceColumnConfig);

  const doc = React.createElement(InvoiceDocument, {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issuedDate: invoice.issuedDate ? invoice.issuedDate.toISOString() : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    shippingTotal: String(invoice.shippingTotal),
    taxRate: String(invoice.taxRate),
    taxBase: invoice.taxBase,
    notes: invoice.notes,
    columnConfig,
    items: invoice.items.map((item) => ({
      id: item.id,
      tag: item.tag,
      name: item.name,
      invoiceDisplayName: item.invoiceDisplayName,
      room: item.room,
      qty: item.qty,
      unitCost: String(item.unitCost),
      platformFee: String(item.platformFee),
      markupPct: item.markupPct === null ? null : String(item.markupPct),
      markupMode: item.markupMode,
    })),
    project: {
      name: invoice.project.name,
      projectAddress: invoice.project.projectAddress,
      defaultMarkupPct: String(invoice.project.defaultMarkupPct),
      markupMode: invoice.project.markupMode,
    },
    client: {
      name: invoice.project.client.name,
      billingAddress: invoice.project.client.billingAddress,
    },
    company: {
      name: settings?.companyName ?? 'Design Firm Ops',
      address: settings?.companyAddress ?? null,
      logoUrl: settings?.logoUrl ?? null,
      primaryColor: settings?.invoicePrimaryColor ?? null,
      accentColor: settings?.invoiceAccentColor ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null,
      owner1Name: settings?.owner1Name ?? null,
      owner1Contact: settings?.owner1Contact ?? null,
      owner2Name: settings?.owner2Name ?? null,
      owner2Contact: settings?.owner2Contact ?? null,
    },
  });

  const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  return { buffer, invoiceNumber: invoice.invoiceNumber };
}
