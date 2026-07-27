import type { PrismaClient } from '@prisma/client';

// A two-firm fixture where both firms hold *deliberately identical* data:
// same client name, same project name, same item tag "LT-1", same invoice
// number "2506-001", same offering "Lighting", same everything.
//
// That's the point. If the fixtures differed, a test could pass by accident —
// finding one row rather than another because the values happened not to
// collide. Making them identical means the only thing that can distinguish
// Firm A's row from Firm B's is the tenant boundary itself, so a passing test
// is evidence about isolation and not about the data.
//
// It also exercises the per-firm uniques directly: this fixture cannot even be
// created unless `@@unique([firmId, …])` is working.

export interface SeededFirm {
  firmId: string;
  clientId: string;
  projectId: string;
  itemId: string;
  invoiceId: string;
  paymentId: string;
  documentId: string;
  leadId: string;
  boardId: string;
  stageId: string;
  vendorId: string;
  offeringId: string;
  procurementListId: string;
  fieldDefId: string;
  contactId: string;
}

/** Identical across both firms, on purpose — see the module comment. */
const SHARED = {
  clientName: 'Westland Reserve Development LLC',
  projectName: 'Red Rock Office',
  itemTag: 'LT-1',
  itemName: 'Verona Chandelier',
  invoiceNumber: '2506-001',
  offeringName: 'Lighting',
  projectTypeName: 'Commercial Office',
  vendorName: 'Circa Lighting',
  boardName: 'Leads',
  stageName: 'New Lead',
  leadName: 'Prospective Client',
  listName: 'Lighting',
  folderName: 'Presentations',
  fieldLabel: 'Lead Time',
  contactName: 'Primary Contact',
} as const;

async function seedFirm(db: PrismaClient, slug: string, name: string): Promise<SeededFirm> {
  const firm = await db.firm.create({ data: { name, slug, status: 'ACTIVE' } });
  const firmId = firm.id;

  const client = await db.client.create({
    data: {
      firmId,
      name: SHARED.clientName,
      contacts: { create: [{ firmId, name: SHARED.contactName, order: 0 }] },
    },
    include: { contacts: true },
  });

  const projectType = await db.projectType.create({ data: { firmId, name: SHARED.projectTypeName } });
  const offering = await db.offering.create({ data: { firmId, name: SHARED.offeringName, order: 0 } });
  const vendor = await db.vendor.create({ data: { firmId, name: SHARED.vendorName } });

  const project = await db.project.create({
    data: {
      firmId,
      clientId: client.id,
      projectTypeId: projectType.id,
      name: SHARED.projectName,
      status: 'ACTIVE',
      defaultMarkupPct: 15,
      markupMode: 'MARKUP',
      salesTaxRate: 0,
      taxBase: 'MERCH_ONLY',
      invoicePrefix: '2506',
    },
  });

  const list = await db.procurementList.create({
    data: { firmId, projectId: project.id, name: SHARED.listName, order: 0 },
  });
  await db.projectDocumentFolder.create({
    data: { firmId, projectId: project.id, name: SHARED.folderName, order: 0 },
  });
  await db.projectRoom.create({ data: { firmId, projectId: project.id, name: 'Reception', order: 0 } });

  const item = await db.item.create({
    data: {
      firmId,
      projectId: project.id,
      procurementListId: list.id,
      vendorId: vendor.id,
      tag: SHARED.itemTag,
      name: SHARED.itemName,
      category: 'Lighting',
      qty: 1,
      unitCost: 100,
      platformFee: 0,
      dimensionUnit: 'IN',
      status: 'APPROVED',
      sortOrder: 1,
    },
  });

  const invoice = await db.invoice.create({
    data: {
      firmId,
      projectId: project.id,
      invoiceNumber: SHARED.invoiceNumber,
      status: 'SENT',
      type: 'PROCUREMENT',
      shippingTotal: 0,
      taxRate: 0,
      taxBase: 'MERCH_ONLY',
      issuedDate: new Date('2026-01-01'),
    },
  });

  const payment = await db.payment.create({
    data: { firmId, projectId: project.id, invoiceId: invoice.id, category: 'MERCHANDISE', amount: 50, method: 'ACH' },
  });

  await db.designFeeCharge.create({
    data: { firmId, projectId: project.id, description: 'Phase 1', amount: 500, date: new Date('2026-01-02') },
  });

  const board = await db.leadBoard.create({ data: { firmId, name: SHARED.boardName, order: 0 } });
  const stage = await db.pipelineStage.create({
    data: { firmId, boardId: board.id, name: SHARED.stageName, order: 0 },
  });
  const lead = await db.lead.create({
    data: { firmId, pipelineStageId: stage.id, clientName: SHARED.leadName, sortOrder: 0 },
  });

  const document = await db.document.create({
    data: { firmId, projectId: project.id, type: 'OTHER', filename: 'plan.pdf', storagePath: `${slug}/plan.pdf` },
  });

  const fieldDef = await db.projectFieldDef.create({
    data: { firmId, label: SHARED.fieldLabel, fieldType: 'TEXT', order: 0 },
  });
  await db.projectFieldValue.create({
    data: { firmId, projectId: project.id, fieldDefId: fieldDef.id, value: '6 weeks' },
  });

  const itemFieldDef = await db.itemFieldDef.create({
    data: { firmId, label: SHARED.fieldLabel, fieldType: 'TEXT', order: 0 },
  });
  await db.itemFieldValue.create({
    data: { firmId, itemId: item.id, fieldDefId: itemFieldDef.id, value: '4 weeks' },
  });

  await db.feeStructureOption.create({ data: { firmId, name: 'Hourly', scope: 'DESIGN_FEE', order: 0 } });
  await db.itemTypeOption.create({ data: { firmId, category: 'Lighting', name: 'Chandelier', tagPrefix: 'CH', order: 0 } });
  await db.resourceFolder.create({ data: { firmId, name: 'Templates', allowedUserIds: [] } });
  await db.referralPartner.create({ data: { firmId, name: 'Referring Architect' } });

  const user = await db.user.create({
    data: { firmId, email: `admin@${slug}.test`, passwordHash: 'x', name: 'Firm Admin', role: 'ADMIN' },
  });
  await db.userPermissionOverride.create({ data: { firmId, userId: user.id, financials: true } });
  await db.resource.create({
    data: { firmId, folder: 'Templates', filename: 'contract.pdf', storagePath: `${slug}/contract.pdf`, uploadedById: user.id },
  });

  // Settings differ per firm on purpose, so resolvePermissions can be shown to
  // read the *right* firm's row rather than merely finding one.
  await db.settings.create({
    data: {
      firmId,
      companyName: name,
      designerCanViewFinancials: slug === 'firm-a',
    },
  });

  return {
    firmId,
    clientId: client.id,
    projectId: project.id,
    itemId: item.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
    documentId: document.id,
    leadId: lead.id,
    boardId: board.id,
    stageId: stage.id,
    vendorId: vendor.id,
    offeringId: offering.id,
    procurementListId: list.id,
    fieldDefId: fieldDef.id,
    contactId: client.contacts[0].id,
  };
}

/**
 * Seeds two firms with identical-looking data.
 *
 * Creating this at all proves the per-firm uniques work: both firms get an
 * offering named "Lighting", an invoice numbered "2506-001", an item tagged
 * "LT-1" and so on. Under the old global uniques the second firm's insert
 * would fail.
 */
export async function seedTwoFirms(db: PrismaClient): Promise<{ a: SeededFirm; b: SeededFirm; shared: typeof SHARED }> {
  const a = await seedFirm(db, 'firm-a', 'Firm A Interiors');
  const b = await seedFirm(db, 'firm-b', 'Firm B Design');
  return { a, b, shared: SHARED };
}
