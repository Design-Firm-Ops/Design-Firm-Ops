import { z } from 'zod';
import { FIRM_STATUSES } from '@/lib/domain';

// ---------- Shared field builders ----------
//
// Forms post every field, so an untouched optional input arrives as "" rather
// than absent. These builders capture that convention once instead of
// repeating `.optional().or(z.literal(''))` on ~60 fields.

/** An optional free-text field: a value, "", or absent. */
export const optionalText = () => z.string().optional().or(z.literal(''));

/** Like `optionalText`, but a non-empty value must be a valid email address. */
export const optionalEmail = () => z.string().email().optional().or(z.literal(''));

/** A required name-ish field, with the message the form shows. */
export const requiredName = (message = 'Name is required') => z.string().min(1, message);

/** A numeric field that treats blank input as "not set" rather than 0. */
export const nullableNumber = (min = 0) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(min).nullable()
  );

/** `nullableNumber` for whole numbers (quantities, square footage). */
export const nullableInt = (min = 0) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(min).nullable()
  );

// Additional points of contact beyond the primary name/email/phone on
// Client itself — the whole array replaces a client's existing rows on
// save, same "full replace" pattern as folder allow-lists.
export const clientContactRowSchema = z.object({
  name: optionalText(),
  email: optionalEmail(),
  phone: optionalText(),
});

export const clientSchema = z.object({
  name: requiredName(),
  contactName: optionalText(),
  email: optionalEmail(),
  phone: optionalText(),
  billingAddress: optionalText(),
  notes: optionalText(),
  contacts: z.array(clientContactRowSchema).optional(),
});

export const vendorSchema = z.object({
  name: requiredName(),
  website: optionalText(),
  repName: optionalText(),
  repEmail: optionalEmail(),
  repPhone: optionalText(),
  showroomName: optionalText(),
  showroomAddress: optionalText(),
  accountType: z.enum(['TRADE', 'RETAIL', 'BOTH']).nullable().optional(),
  productType: z.enum(['STOCK', 'CUSTOM', 'BOTH']).nullable().optional(),
  priceRange: z.enum(['LOW', 'MID', 'HIGH']).nullable().optional(),
  // IDs of user-customizable Offering rows — no longer a fixed enum.
  offerings: z.array(z.string()).default([]),
  notes: optionalText(),
  accountNumber: optionalText(),
  tradeAccountUsername: optionalText(),
  tradeAccountPassword: optionalText(), // plaintext in transit only — encrypted before storage
  tradeAccountNotes: optionalText(),
});

export const projectSchema = z.object({
  clientId: optionalText(),
  name: requiredName(),
  projectAddress: optionalText(),
  status: z.enum(['LEAD', 'ACTIVE', 'ON_HOLD', 'COMPLETE']).default('LEAD'),
  startDate: optionalText(),
  projectType: optionalText(),
  leadDesignerName: optionalText(),
  // Free text — resolved to a FeeStructureOption row (creating a new
  // custom option if it doesn't exist yet). See lib/feeStructure.ts.
  designFeeStructure: optionalText(),
  procurementFeeStructure: optionalText(),
  feeNotes: optionalText(),
  defaultMarkupPct: z.coerce.number().min(0).max(1000).default(15),
  markupMode: z.enum(['MARKUP', 'MARGIN']).default('MARKUP'),
  salesTaxRate: z.coerce.number().min(0).max(1).default(0),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).default('MERCH_ONLY'),
  invoicePrefix: optionalText(),
  // Columns new invoices on this project start with — see lib/invoiceColumns.ts.
  defaultInvoiceColumnConfig: z.object({ columns: z.array(z.string()) }).nullable().optional(),
  // Only present when creating a project with a brand-new client inline.
  newClientName: optionalText(),
  newClientEmail: optionalText(),
  newClientPhone: optionalText(),
  newClientAddress: optionalText(),
});

export const itemSchema = z.object({
  projectId: z.string().min(1),
  // Left blank on creation until an item type is chosen, which
  // auto-fills it — see lib/itemTag.ts.
  tag: optionalText(),
  name: requiredName(),
  invoiceDisplayName: optionalText(),
  // Free text — matches this project's Procurement list names, see
  // Item.category comment in schema.prisma.
  category: z.string().min(1).default('Other Merchandise'),
  // Free text, resolved to an ItemTypeOption row (creating a new
  // custom type if it doesn't exist yet) scoped under category — see
  // lib/itemType.ts.
  itemType: optionalText(),
  room: optionalText(),
  vendorId: optionalText(),
  procurementListId: optionalText(),
  qty: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0),
  platformFee: z.coerce.number().min(0).default(0),
  markupPct: z.coerce.number().min(0).max(1000).nullable().optional(),
  markupMode: z.enum(['MARKUP', 'MARGIN']).nullable().optional(),
  dimensionHeight: z.coerce.number().min(0).nullable().optional(),
  dimensionWidth: z.coerce.number().min(0).nullable().optional(),
  dimensionLength: z.coerce.number().min(0).nullable().optional(),
  dimensionUnit: z.enum(['IN', 'CM']).default('IN'),
  weight: z.coerce.number().min(0).nullable().optional(),
  bulbSpec: optionalText(),
  bulbQty: z.coerce.number().int().min(0).nullable().optional(),
  // Tri-state: null/omitted = not yet reviewed, true = included, false
  // = confirmed not included (only "false" rows feed the Bulbs summary).
  bulbIncluded: z.boolean().nullable().optional(),
  finish: optionalText(),
  link: optionalText(),
  shippingNotes: optionalText(),
  status: z.enum(['PROPOSED', 'APPROVED', 'INVOICED', 'ORDERED', 'RECEIVED', 'DELIVERED']).default('PROPOSED'),
});

export const itemUpdateSchema = itemSchema.partial().omit({ projectId: true }).extend({
  // Bypasses the invoiced-item lock — see /api/items/[id] PATCH.
  unlockOverride: z.boolean().optional(),
});

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color, e.g. #4A3728')
  .optional()
  .or(z.literal(''));

export const settingsSchema = z.object({
  companyName: requiredName('Company name is required'),
  companyAddress: optionalText(),
  owner1Name: optionalText(),
  owner1Contact: optionalText(),
  owner2Name: optionalText(),
  owner2Contact: optionalText(),
  paymentInstructions: optionalText(),
  logoUrl: optionalText(),
  invoicePrimaryColor: hexColor,
  invoiceAccentColor: hexColor,
});

export const permissionsSchema = z.object({
  designerCanViewFinancials: z.boolean(),
  designerCanViewClientContact: z.boolean(),
  designerCanViewDocumentsPresentations: z.boolean(),
  designerCanViewContracts: z.boolean(),
  designerCanViewInvoices: z.boolean(),
  designerCanViewProcurement: z.boolean(),
  designerCanViewVendorCredentials: z.boolean(),
});

// A field left out (or set to null) means "inherit the Designer role
// default" for that one person — see lib/permissions.ts.
export const userPermissionOverrideSchema = z.object({
  financials: z.boolean().nullable().optional(),
  clientContact: z.boolean().nullable().optional(),
  documentsPresentations: z.boolean().nullable().optional(),
  contracts: z.boolean().nullable().optional(),
  invoices: z.boolean().nullable().optional(),
  procurement: z.boolean().nullable().optional(),
  vendorCredentials: z.boolean().nullable().optional(),
});

export const paymentSchema = z.object({
  projectId: z.string().min(1),
  invoiceId: optionalText(),
  category: z.enum(['MERCHANDISE', 'DESIGN_FEE']).default('MERCHANDISE'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: optionalText(),
  method: z.enum(['ACH', 'WIRE', 'CHECK', 'CREDIT_CARD', 'OTHER']).default('OTHER'),
  reference: optionalText(),
  notes: optionalText(),
});

export const paymentUpdateSchema = paymentSchema.partial().omit({ projectId: true });

export const invoiceCreateSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['PROCUREMENT', 'DESIGN_FEE']).default('PROCUREMENT'),
  // Exactly one of itemIds/designFeeChargeIds is used, depending on
  // type — see /api/invoices POST. newDesignFeeCharges (DESIGN_FEE
  // only) are created as DesignFeeCharge rows and attached in the same
  // request — this is how "billing" and "invoicing" merge into one step.
  itemIds: z.array(z.string()).default([]),
  designFeeChargeIds: z.array(z.string()).default([]),
  newDesignFeeCharges: z
    .array(z.object({ description: z.string().min(1), amount: z.coerce.number().positive() }))
    .default([]),
  shippingTotal: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(1).optional(),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).optional(),
  dueDate: optionalText(),
  notes: optionalText(),
});

export const invoiceUpdateSchema = z.object({
  columnConfig: z.object({ columns: z.array(z.string()) }).nullable().optional(),
  dueDate: optionalText(),
  notes: optionalText(),
});

export const designFeeChargeSchema = z.object({
  projectId: z.string().min(1),
  description: requiredName('Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: optionalText(),
});

// ---------- Business Development ----------

export const leadBoardSchema = z.object({
  name: requiredName(),
});

export const pipelineStageSchema = z.object({
  name: requiredName(),
  boardId: z.string().min(1),
});

export const pipelineStageUpdateSchema = z.object({
  name: z.string().min(1).optional(),
});

export const referralPartnerSchema = z.object({
  name: requiredName(),
  businessName: optionalText(),
  contactEmail: optionalEmail(),
  contactPhone: optionalText(),
  notes: optionalText(),
});

export const leadSchema = z.object({
  clientName: requiredName('Client name is required'),
  projectType: optionalText(),
  referralSource: optionalText(),
  referralPartnerId: optionalText(),
  contactEmail: optionalEmail(),
  contactPhone: optionalText(),
  address: optionalText(),
  notes: optionalText(),
  pipelineStageId: z.string().min(1),
  squareFootage: nullableInt(),
  estimatedBudget: nullableNumber(),
  timeline: optionalText(),
  builderName: optionalText(),
  architectName: optionalText(),
});

export const leadUpdateSchema = leadSchema.partial();

export const leadMoveSchema = z.object({
  pipelineStageId: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

// ---------- Administration ----------

export const userCreateSchema = z.object({
  name: requiredName(),
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'DESIGNER']).default('DESIGNER'),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'DESIGNER']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional().or(z.literal('')),
});

export const resourceFolderPermissionSchema = z.object({
  allowedUserIds: z.array(z.string()).default([]),
});

// ---------- Customizable taxonomies ----------

export const offeringSchema = z.object({
  name: requiredName(),
});

export const feeStructureOptionSchema = z.object({
  name: requiredName(),
  scope: z.enum(['DESIGN_FEE', 'PROCUREMENT']),
});

export const itemTypeCreateSchema = z.object({
  category: requiredName('Category is required'),
  name: requiredName(),
});

export const procurementListSchema = z.object({
  projectId: z.string().min(1),
  name: requiredName(),
});

export const procurementListUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

const fieldDefBaseSchema = z.object({
  label: requiredName('Label is required'),
  fieldType: z.enum(['TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'RICH_TEXT']).default('TEXT'),
  visibleToDesigner: z.boolean().default(true),
});

export const projectFieldDefSchema = fieldDefBaseSchema;
export const projectFieldDefUpdateSchema = fieldDefBaseSchema.partial().extend({
  order: z.number().int().optional(),
});

export const itemFieldDefSchema = fieldDefBaseSchema;
export const itemFieldDefUpdateSchema = fieldDefBaseSchema.partial().extend({
  order: z.number().int().optional(),
});

export const fieldValueSchema = z.object({
  fieldDefId: z.string().min(1),
  value: z.string().nullable().optional(),
});

// The body every drag-to-reorder endpoint takes: the full list of ids in
// their new order. See `applyOrder` in lib/apiRoute.ts.
export const reorderSchema = z.object({
  order: z.array(z.string()).min(1),
});

// ---------- Documents ----------

export const documentFolderSchema = z.object({
  projectId: z.string().min(1),
  name: requiredName('Folder name is required'),
});

export const documentFolderUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

// ---------- Platform console (DES-27) ----------

/** The body of a firm status change. The *legality* of the move is `canTransition`. */
export const firmStatusSchema = z.object({
  status: z.enum(FIRM_STATUSES),
});
