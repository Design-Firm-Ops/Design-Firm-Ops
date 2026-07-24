import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/server/prisma';
import { storage } from '@/server/storage';
import { resolveColumnConfig, InvoiceColumnKey } from '@/lib/invoiceColumns';
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument';

/** Fetches everything an invoice PDF needs and renders it to a Buffer. */
export async function renderInvoicePdf(invoiceId: string): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      designFeeCharges: true,
      project: { include: { client: true } },
    },
  });
  if (!invoice) return null;

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });

  // Design Fee Invoices are a flat list of charges — no tag/markup/photo
  // columns apply, so their PDF always uses a fixed minimal layout
  // regardless of the project's or invoice's column config.
  const columnConfig =
    invoice.type === 'DESIGN_FEE'
      ? { columns: ['description', 'extended'] as InvoiceColumnKey[] }
      : resolveColumnConfig(invoice.columnConfig, invoice.project.defaultInvoiceColumnConfig);

  const items =
    invoice.type === 'DESIGN_FEE'
      ? invoice.designFeeCharges.map((charge) => ({
          id: charge.id,
          tag: '',
          name: charge.description,
          invoiceDisplayName: charge.description,
          room: 'Design Fee',
          qty: 1,
          unitCost: String(charge.amount),
          platformFee: '0',
          markupPct: '0',
          markupMode: 'MARKUP' as const,
          imageUrl: null,
        }))
      : await Promise.all(
          invoice.items.map(async (item) => ({
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
            imageUrl: item.imageStoragePath ? await storage.createSignedUrl('documents', item.imageStoragePath) : null,
          }))
        );

  const doc = React.createElement(InvoiceDocument, {
    invoiceNumber: invoice.invoiceNumber,
    documentLabel: invoice.type === 'DESIGN_FEE' ? 'Design Fee Invoice' : 'Invoice',
    status: invoice.status,
    issuedDate: invoice.issuedDate ? invoice.issuedDate.toISOString() : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    shippingTotal: String(invoice.shippingTotal),
    taxRate: String(invoice.taxRate),
    taxBase: invoice.taxBase,
    notes: invoice.notes,
    columnConfig,
    items,
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
