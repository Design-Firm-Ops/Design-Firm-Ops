import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSignedDocumentUrl } from '@/lib/supabase';
import { resolvePermissions, isAdmin as checkIsAdmin } from '@/lib/permissions';
import { summarizeProjectFinancials, summarizeDesignFee } from '@/lib/financials';
import { DEFAULT_DOCUMENT_FOLDERS } from '@/lib/procurement';
import ProjectHeader from './ProjectHeader';
import ProjectTabs, { ProjectTab } from './ProjectTabs';
import ProcurementTabs from './ProcurementTabs';
import { ItemRow } from './ItemsTable';
import InvoicesTab, { InvoiceRow } from './InvoicesTab';
import ProjectDocumentsBrowser, { DocumentRow as FolderDocumentRow } from './ProjectDocumentsBrowser';
import DocumentsTab, { DocumentRow } from './DocumentsTab';
import PaymentsTab, { PaymentRow } from './PaymentsTab';

export const dynamic = 'force-dynamic';

function serializeInvoiceItem(item: {
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
}) {
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
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);
  const admin = checkIsAdmin(session);

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      projectType: true,
      items: { orderBy: { sortOrder: 'asc' }, include: { fieldValues: true } },
      procurementLists: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      invoices: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { date: 'desc' } },
      designFeeCharges: { orderBy: { date: 'desc' } },
      fieldValues: true,
    },
  });

  if (!project) notFound();

  const [vendors, projectTypes, offerings, itemFieldDefs, projectFieldDefs] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.offering.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemFieldDef.findMany({ orderBy: { order: 'asc' } }),
    prisma.projectFieldDef.findMany({ orderBy: { order: 'asc' } }),
  ]);

  const items: ItemRow[] = await Promise.all(
    project.items.map(async (item) => ({
      ...serializeInvoiceItem(item),
      offeringId: item.offeringId,
      procurementListId: item.procurementListId,
      imageUrl: item.imageStoragePath ? await createSignedDocumentUrl(item.imageStoragePath) : null,
      fieldValues: item.fieldValues.map((v) => ({ fieldDefId: v.fieldDefId, value: v.value })),
    }))
  );
  const uninvoicedItems = items.filter((i) => !i.invoiceId);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const invoices: InvoiceRow[] = project.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    shippingTotal: String(inv.shippingTotal),
    taxRate: String(inv.taxRate),
    taxBase: inv.taxBase,
    issuedDate: inv.issuedDate ? inv.issuedDate.toISOString() : null,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    items: inv.items.map((it) => itemsById.get(it.id)!).filter(Boolean),
  }));

  // Signed URLs are minted fresh on every load (they expire) — never
  // read the raw storage path back to the browser.
  const allDocuments = await Promise.all(
    project.documents
      .filter((d) => !d.itemId)
      .map(async (d) => ({
        id: d.id,
        type: d.type,
        filename: d.filename,
        folder: d.folder,
        url: await createSignedDocumentUrl(d.storagePath),
        uploadedAt: d.uploadedAt.toISOString(),
      }))
  );
  const contractDocuments: DocumentRow[] = allDocuments.filter((d) => d.type === 'CONTRACT');
  const presentationDocuments: FolderDocumentRow[] = allDocuments.filter((d) => d.type !== 'CONTRACT');

  const payments: PaymentRow[] = project.payments
    .filter((p) => p.category === 'MERCHANDISE')
    .map((p) => ({
      id: p.id,
      amount: String(p.amount),
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      invoiceId: p.invoiceId,
    }));

  const merchandise = summarizeProjectFinancials(project);
  const designFee = summarizeDesignFee(project);

  const procurementLists = project.procurementLists.map((list) => ({
    id: list.id,
    name: list.name,
    items: items.filter((i) => i.procurementListId === list.id),
  }));
  const unassignedItems = items.filter((i) => !i.procurementListId);
  if (unassignedItems.length > 0) {
    procurementLists.push({ id: 'unassigned', name: 'Unassigned', items: unassignedItems });
  }

  const tabs: ProjectTab[] = [];
  if (perms.documentsPresentations) {
    tabs.push({
      key: 'documents',
      label: 'Documents and Presentations',
      content: (
        <ProjectDocumentsBrowser projectId={project.id} documents={presentationDocuments} defaultFolders={DEFAULT_DOCUMENT_FOLDERS} />
      ),
    });
  }
  if (perms.contracts) {
    tabs.push({
      key: 'contract',
      label: 'Contract',
      content: (
        <DocumentsTab
          projectId={project.id}
          documents={contractDocuments}
          allowedTypes={['CONTRACT']}
          defaultType="CONTRACT"
          emptyLabel="No contracts uploaded yet."
        />
      ),
    });
  }
  if (perms.invoices) {
    tabs.push({
      key: 'invoices',
      label: 'Invoices',
      content: (
        <div>
          <InvoicesTab
            projectId={project.id}
            invoices={invoices}
            uninvoicedItems={uninvoicedItems}
            projectDefaultMarkupPct={String(project.defaultMarkupPct)}
            projectMarkupMode={project.markupMode}
            defaultTaxRate={String(project.salesTaxRate)}
            defaultTaxBase={project.taxBase}
          />
          <PaymentsTab
            projectId={project.id}
            payments={payments}
            invoiceOptions={invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }))}
          />
        </div>
      ),
    });
  }
  if (perms.procurement) {
    tabs.push({
      key: 'procurement',
      label: 'Procurement',
      content: (
        <ProcurementTabs
          projectId={project.id}
          lists={procurementLists}
          vendors={vendors}
          offeringOptions={offerings.map((o) => ({ id: o.id, name: o.name }))}
          itemFieldDefs={itemFieldDefs}
          isAdmin={admin}
          projectDefaultMarkupPct={String(project.defaultMarkupPct)}
          projectMarkupMode={project.markupMode}
        />
      ),
    });
  }

  return (
    <div>
      <ProjectHeader
        project={{
          id: project.id,
          name: project.name,
          projectAddress: project.projectAddress,
          status: project.status,
          startDate: project.startDate ? project.startDate.toISOString() : null,
          projectType: project.projectType?.name ?? null,
          leadDesignerName: project.leadDesignerName,
          feeStructure: project.feeStructure,
          feeNotes: project.feeNotes,
          defaultMarkupPct: String(project.defaultMarkupPct),
          markupMode: project.markupMode,
          salesTaxRate: String(project.salesTaxRate),
          taxBase: project.taxBase,
          invoicePrefix: project.invoicePrefix,
          client: {
            id: project.client.id,
            name: project.client.name,
            email: project.client.email,
            phone: project.client.phone,
            billingAddress: project.client.billingAddress,
          },
        }}
        projectTypeOptions={projectTypes.map((t) => t.name)}
        canViewClientContact={perms.clientContact}
        canViewFinancials={perms.financials}
        merchandise={merchandise}
        designFee={designFee}
        fieldDefs={projectFieldDefs}
        fieldValues={project.fieldValues.map((v) => ({ fieldDefId: v.fieldDefId, value: v.value }))}
        isAdmin={admin}
      />

      <ProjectTabs tabs={tabs} />
    </div>
  );
}
