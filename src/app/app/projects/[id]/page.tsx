import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProjectHeader from './ProjectHeader';
import ProjectTabs from './ProjectTabs';
import ItemsTable, { ItemRow } from './ItemsTable';
import InvoicesTab, { InvoiceRow } from './InvoicesTab';
import DocumentsTab, { DocumentRow } from './DocumentsTab';
import PaymentsTab, { PaymentRow } from './PaymentsTab';

export const dynamic = 'force-dynamic';

function serializeItem(item: {
  id: string;
  tag: string;
  name: string;
  invoiceDisplayName: string | null;
  category: string;
  room: string | null;
  vendorId: string | null;
  qty: number;
  unitCost: unknown;
  platformFee: unknown;
  markupPct: unknown;
  markupMode: string | null;
  dimensions: string | null;
  finish: string | null;
  link: string | null;
  shippingNotes: string | null;
  status: string;
  invoiceId: string | null;
}): ItemRow {
  return {
    id: item.id,
    tag: item.tag,
    name: item.name,
    invoiceDisplayName: item.invoiceDisplayName,
    category: item.category,
    room: item.room,
    vendorId: item.vendorId,
    qty: item.qty,
    unitCost: String(item.unitCost),
    platformFee: String(item.platformFee),
    markupPct: item.markupPct === null ? null : String(item.markupPct),
    markupMode: item.markupMode,
    dimensions: item.dimensions,
    finish: item.finish,
    link: item.link,
    shippingNotes: item.shippingNotes,
    status: item.status,
    invoiceId: item.invoiceId,
  };
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      invoices: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { date: 'desc' } },
    },
  });

  if (!project) notFound();

  const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  const items: ItemRow[] = project.items.map(serializeItem);
  const uninvoicedItems = items.filter((i) => !i.invoiceId);

  const invoices: InvoiceRow[] = project.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    shippingTotal: String(inv.shippingTotal),
    taxRate: String(inv.taxRate),
    taxBase: inv.taxBase,
    issuedDate: inv.issuedDate ? inv.issuedDate.toISOString() : null,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    items: inv.items.map(serializeItem),
  }));

  const documents: DocumentRow[] = project.documents.map((d) => ({
    id: d.id,
    type: d.type,
    filename: d.filename,
    storageUrl: d.storageUrl,
    uploadedAt: d.uploadedAt.toISOString(),
  }));

  const payments: PaymentRow[] = project.payments.map((p) => ({
    id: p.id,
    amount: String(p.amount),
    date: p.date.toISOString(),
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    invoiceId: p.invoiceId,
  }));

  return (
    <div>
      <ProjectHeader
        project={{
          id: project.id,
          name: project.name,
          projectAddress: project.projectAddress,
          status: project.status,
          startDate: project.startDate ? project.startDate.toISOString() : null,
          feeStructure: project.feeStructure,
          feeNotes: project.feeNotes,
          defaultMarkupPct: String(project.defaultMarkupPct),
          markupMode: project.markupMode,
          salesTaxRate: String(project.salesTaxRate),
          taxBase: project.taxBase,
          invoicePrefix: project.invoicePrefix,
          client: { id: project.client.id, name: project.client.name },
        }}
      />

      <ProjectTabs
        panels={{
          Items: (
            <ItemsTable
              projectId={project.id}
              initialItems={items}
              vendors={vendors}
              projectDefaultMarkupPct={String(project.defaultMarkupPct)}
              projectMarkupMode={project.markupMode}
            />
          ),
          Invoices: (
            <InvoicesTab
              projectId={project.id}
              invoices={invoices}
              uninvoicedItems={uninvoicedItems}
              projectDefaultMarkupPct={String(project.defaultMarkupPct)}
              projectMarkupMode={project.markupMode}
              defaultTaxRate={String(project.salesTaxRate)}
              defaultTaxBase={project.taxBase}
            />
          ),
          Contracts: (
            <DocumentsTab
              projectId={project.id}
              documents={documents.filter((d) => d.type === 'CONTRACT')}
              allowedTypes={['CONTRACT']}
              defaultType="CONTRACT"
              emptyLabel="No contracts uploaded yet."
            />
          ),
          Documents: <DocumentsTab projectId={project.id} documents={documents} />,
          Payments: (
            <PaymentsTab
              projectId={project.id}
              payments={payments}
              invoiceOptions={invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }))}
            />
          ),
        }}
      />
    </div>
  );
}
