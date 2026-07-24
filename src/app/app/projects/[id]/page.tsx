import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { getProjectDetail, getProjectDetailOptions } from '@/server/queries/projects';
import { storage } from '@/server/storage';
import { resolvePermissions, isAdmin as checkIsAdmin } from '@/server/permissions';
import { summarizeProjectFinancials, summarizeDesignFee } from '@/lib/financials';
import ProjectHeader from './ProjectHeader';
import Tabs, { type Tab } from '@/components/Tabs';
import ProcurementTabs from './ProcurementTabs';
import { ItemRow } from './ItemsTable';
import InvoicesTab, { InvoiceRow } from './InvoicesTab';
import DesignFeeSection, { DesignFeeChargeRow, DesignFeeInvoiceRow } from './DesignFeeSection';
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
  itemTypeId: string | null;
  itemType?: { name: string } | null;
  room: string | null;
  vendorId: string | null;
  qty: number;
  unitCost: unknown;
  platformFee: unknown;
  markupPct: unknown;
  markupMode: string | null;
  dimensionHeight: unknown;
  dimensionWidth: unknown;
  dimensionLength: unknown;
  dimensionUnit: string;
  weight: unknown;
  bulbSpec: string | null;
  bulbQty: number | null;
  bulbIncluded: boolean | null;
  finish: string | null;
  link: string | null;
  shippingNotes: string | null;
  status: string;
  invoiceId: string | null;
  invoice?: { invoiceNumber: string } | null;
}) {
  return {
    id: item.id,
    tag: item.tag,
    name: item.name,
    invoiceDisplayName: item.invoiceDisplayName,
    category: item.category,
    itemTypeId: item.itemTypeId,
    itemTypeName: item.itemType?.name ?? null,
    room: item.room,
    vendorId: item.vendorId,
    qty: item.qty,
    unitCost: String(item.unitCost),
    platformFee: String(item.platformFee),
    markupPct: item.markupPct === null ? null : String(item.markupPct),
    markupMode: item.markupMode,
    dimensionHeight: item.dimensionHeight === null ? null : String(item.dimensionHeight),
    dimensionWidth: item.dimensionWidth === null ? null : String(item.dimensionWidth),
    dimensionLength: item.dimensionLength === null ? null : String(item.dimensionLength),
    dimensionUnit: item.dimensionUnit,
    weight: item.weight === null ? null : String(item.weight),
    bulbSpec: item.bulbSpec,
    bulbQty: item.bulbQty,
    bulbIncluded: item.bulbIncluded,
    finish: item.finish,
    link: item.link,
    shippingNotes: item.shippingNotes,
    status: item.status,
    invoiceId: item.invoiceId,
    invoiceNumber: item.invoice?.invoiceNumber ?? null,
  };
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const perms = await resolvePermissions(session);
  const admin = checkIsAdmin(session);

  const project = await getProjectDetail(params.id);

  if (!project) notFound();

  const { vendors, projectTypes, feeStructureOptions, itemTypeOptions, itemFieldDefs, projectFieldDefs } =
    await getProjectDetailOptions();

  const designFeeStructureOptions = feeStructureOptions.filter((f) => f.scope === 'DESIGN_FEE').map((f) => f.name);
  const procurementFeeStructureOptions = feeStructureOptions.filter((f) => f.scope === 'PROCUREMENT').map((f) => f.name);

  const items: ItemRow[] = await Promise.all(
    project.items.map(async (item) => ({
      ...serializeInvoiceItem(item),
      procurementListId: item.procurementListId,
      imageUrl: item.imageStoragePath ? await storage.createSignedUrl('documents', item.imageStoragePath) : null,
      fieldValues: item.fieldValues.map((v) => ({ fieldDefId: v.fieldDefId, value: v.value })),
    }))
  );
  const uninvoicedItems = items.filter((i) => !i.invoiceId);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const invoices: InvoiceRow[] = project.invoices
    .filter((inv) => inv.type === 'PROCUREMENT')
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      shippingTotal: String(inv.shippingTotal),
      taxRate: String(inv.taxRate),
      taxBase: inv.taxBase,
      issuedDate: inv.issuedDate ? inv.issuedDate.toISOString() : null,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      columnConfig: inv.columnConfig as { columns: string[] } | null,
      items: inv.items.map((it) => itemsById.get(it.id)!).filter(Boolean),
    }));

  const designFeeChargeRows: DesignFeeChargeRow[] = project.designFeeCharges.map((c) => ({
    id: c.id,
    description: c.description,
    amount: String(c.amount),
    date: c.date.toISOString(),
    invoiceId: c.invoiceId,
    invoiceNumber: c.invoice?.invoiceNumber ?? null,
  }));
  const chargesById = new Map(designFeeChargeRows.map((c) => [c.id, c]));

  const designFeeInvoices: DesignFeeInvoiceRow[] = project.invoices
    .filter((inv) => inv.type === 'DESIGN_FEE')
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      issuedDate: inv.issuedDate ? inv.issuedDate.toISOString() : null,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      shippingTotal: String(inv.shippingTotal),
      taxRate: String(inv.taxRate),
      taxBase: inv.taxBase,
      charges: inv.designFeeCharges.map((c) => chargesById.get(c.id)!).filter(Boolean),
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
        url: await storage.createSignedUrl('documents', d.storagePath),
        uploadedAt: d.uploadedAt.toISOString(),
      }))
  );
  const contractDocuments: DocumentRow[] = allDocuments.filter((d) => d.type === 'CONTRACT');
  const presentationDocuments: FolderDocumentRow[] = allDocuments.filter((d) => d.type !== 'CONTRACT');

  function serializePayment(p: {
    id: string;
    amount: unknown;
    date: Date;
    method: string;
    reference: string | null;
    notes: string | null;
    invoiceId: string | null;
  }): PaymentRow {
    return {
      id: p.id,
      amount: String(p.amount),
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      invoiceId: p.invoiceId,
    };
  }
  const merchandisePayments = project.payments.filter((p) => p.category === 'MERCHANDISE').map(serializePayment);
  const designFeePayments = project.payments.filter((p) => p.category === 'DESIGN_FEE').map(serializePayment);

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

  const tabs: Tab[] = [];
  if (perms.documentsPresentations) {
    tabs.push({
      key: 'documents',
      label: 'Project Documents',
      content: (
        <ProjectDocumentsBrowser
          projectId={project.id}
          documents={presentationDocuments}
          folders={project.documentFolders.map((f) => ({ id: f.id, name: f.name }))}
        />
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
  if (perms.invoices || perms.financials) {
    tabs.push({
      key: 'invoices',
      label: 'Invoices and Payments',
      content: (
        <div className="space-y-10">
          {perms.invoices && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-brown">Procurement</h2>
              <InvoicesTab
                projectId={project.id}
                invoices={invoices}
                uninvoicedItems={uninvoicedItems}
                projectDefaultMarkupPct={String(project.defaultMarkupPct)}
                projectMarkupMode={project.markupMode}
                defaultTaxRate={String(project.salesTaxRate)}
                defaultTaxBase={project.taxBase}
                projectDefaultColumnConfig={project.defaultInvoiceColumnConfig as { columns: string[] } | null}
              />
              <div className="mt-6 border-t border-taupe/30 pt-6">
                <PaymentsTab
                  projectId={project.id}
                  category="MERCHANDISE"
                  title="Procurement Payments"
                  payments={merchandisePayments}
                  invoiceOptions={invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }))}
                />
              </div>
            </section>
          )}
          {perms.financials && (
            <section>
              <h2 className="mb-4 text-lg font-medium text-brown">Design Fee</h2>
              <DesignFeeSection projectId={project.id} charges={designFeeChargeRows} invoices={designFeeInvoices} />
              <div className="mt-6 border-t border-taupe/30 pt-6">
                <PaymentsTab
                  projectId={project.id}
                  category="DESIGN_FEE"
                  title="Design Fee Payments"
                  payments={designFeePayments}
                  invoiceOptions={designFeeInvoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber }))}
                />
              </div>
            </section>
          )}
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
          itemTypeOptions={itemTypeOptions.map((t) => ({ id: t.id, category: t.category, name: t.name }))}
          roomOptions={project.rooms.map((r) => r.name)}
          itemFieldDefs={itemFieldDefs}
          isAdmin={admin}
          canOverrideLock={perms.invoices}
          canViewFees={perms.financials}
          feeData={{
            procurementFeeStructure: project.procurementFeeStructure?.name ?? null,
            defaultMarkupPct: String(project.defaultMarkupPct),
            markupMode: project.markupMode,
            salesTaxRate: String(project.salesTaxRate),
            taxBase: project.taxBase,
          }}
          procurementFeeStructureOptions={procurementFeeStructureOptions}
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
          designFeeStructure: project.designFeeStructure?.name ?? null,
          feeNotes: project.feeNotes,
          invoicePrefix: project.invoicePrefix,
          defaultInvoiceColumnConfig: project.defaultInvoiceColumnConfig as { columns: string[] } | null,
          client: {
            id: project.client.id,
            name: project.client.name,
            contactName: project.client.contactName,
            email: project.client.email,
            phone: project.client.phone,
            billingAddress: project.client.billingAddress,
            contacts: project.client.contacts.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
          },
        }}
        projectTypeOptions={projectTypes.map((t) => t.name)}
        designFeeStructureOptions={designFeeStructureOptions}
        canViewClientContact={perms.clientContact}
        canViewFinancials={perms.financials}
        merchandise={merchandise}
        designFee={designFee}
        fieldDefs={projectFieldDefs}
        fieldValues={project.fieldValues.map((v) => ({ fieldDefId: v.fieldDefId, value: v.value }))}
        isAdmin={admin}
      />

      <Tabs tabs={tabs} />
    </div>
  );
}
