import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  billingAddress: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  website: z.string().optional().or(z.literal('')),
  repName: z.string().optional().or(z.literal('')),
  repEmail: z.string().email().optional().or(z.literal('')),
  repPhone: z.string().optional().or(z.literal('')),
  showroomName: z.string().optional().or(z.literal('')),
  showroomAddress: z.string().optional().or(z.literal('')),
  accountType: z.enum(['TRADE', 'RETAIL', 'BOTH']).nullable().optional(),
  productType: z.enum(['STOCK', 'CUSTOM', 'BOTH']).nullable().optional(),
  priceRange: z.enum(['LOW', 'MID', 'HIGH']).nullable().optional(),
  // IDs of user-customizable Offering rows — no longer a fixed enum.
  offerings: z.array(z.string()).default([]),
  notes: z.string().optional().or(z.literal('')),
  accountNumber: z.string().optional().or(z.literal('')),
  tradeAccountUsername: z.string().optional().or(z.literal('')),
  tradeAccountPassword: z.string().optional().or(z.literal('')), // plaintext in transit only — encrypted before storage
  tradeAccountNotes: z.string().optional().or(z.literal('')),
});

export const projectSchema = z.object({
  clientId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Name is required'),
  projectAddress: z.string().optional().or(z.literal('')),
  status: z.enum(['LEAD', 'ACTIVE', 'ON_HOLD', 'COMPLETE']).default('LEAD'),
  startDate: z.string().optional().or(z.literal('')),
  projectType: z.string().optional().or(z.literal('')),
  leadDesignerName: z.string().optional().or(z.literal('')),
  // Free text — resolved to a FeeStructureOption row (creating a new
  // custom option if it doesn't exist yet). See lib/feeStructure.ts.
  designFeeStructure: z.string().optional().or(z.literal('')),
  procurementFeeStructure: z.string().optional().or(z.literal('')),
  feeNotes: z.string().optional().or(z.literal('')),
  defaultMarkupPct: z.coerce.number().min(0).max(1000).default(15),
  markupMode: z.enum(['MARKUP', 'MARGIN']).default('MARKUP'),
  salesTaxRate: z.coerce.number().min(0).max(1).default(0),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).default('MERCH_ONLY'),
  invoicePrefix: z.string().optional().or(z.literal('')),
  // Columns new invoices on this project start with — see lib/invoiceColumns.ts.
  defaultInvoiceColumnConfig: z.object({ columns: z.array(z.string()) }).nullable().optional(),
  // Only present when creating a project with a brand-new client inline.
  newClientName: z.string().optional().or(z.literal('')),
  newClientEmail: z.string().optional().or(z.literal('')),
  newClientPhone: z.string().optional().or(z.literal('')),
  newClientAddress: z.string().optional().or(z.literal('')),
});

export const itemSchema = z.object({
  projectId: z.string().min(1),
  tag: z.string().min(1, 'Tag is required'),
  name: z.string().min(1, 'Name is required'),
  invoiceDisplayName: z.string().optional().or(z.literal('')),
  category: z
    .enum(['LIGHTING', 'FURNITURE', 'PLUMBING', 'HARDWARE', 'TEXTILES', 'ART', 'ACCESSORIES', 'APPLIANCES', 'OTHER'])
    .default('OTHER'),
  room: z.string().optional().or(z.literal('')),
  vendorId: z.string().optional().or(z.literal('')),
  offeringId: z.string().optional().or(z.literal('')),
  procurementListId: z.string().optional().or(z.literal('')),
  qty: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0),
  platformFee: z.coerce.number().min(0).default(0),
  markupPct: z.coerce.number().min(0).max(1000).nullable().optional(),
  markupMode: z.enum(['MARKUP', 'MARGIN']).nullable().optional(),
  dimensions: z.string().optional().or(z.literal('')),
  finish: z.string().optional().or(z.literal('')),
  link: z.string().optional().or(z.literal('')),
  shippingNotes: z.string().optional().or(z.literal('')),
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
  companyName: z.string().min(1, 'Company name is required'),
  companyAddress: z.string().optional().or(z.literal('')),
  owner1Name: z.string().optional().or(z.literal('')),
  owner1Contact: z.string().optional().or(z.literal('')),
  owner2Name: z.string().optional().or(z.literal('')),
  owner2Contact: z.string().optional().or(z.literal('')),
  paymentInstructions: z.string().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
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
  invoiceId: z.string().optional().or(z.literal('')),
  category: z.enum(['MERCHANDISE', 'DESIGN_FEE']).default('MERCHANDISE'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().optional().or(z.literal('')),
  method: z.enum(['ACH', 'WIRE', 'CHECK', 'CREDIT_CARD', 'OTHER']).default('OTHER'),
  reference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const paymentUpdateSchema = paymentSchema.partial().omit({ projectId: true });

export const invoiceCreateSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(['PROCUREMENT', 'DESIGN_FEE']).default('PROCUREMENT'),
  // Exactly one of these is used, depending on type — see /api/invoices POST.
  itemIds: z.array(z.string()).default([]),
  designFeeChargeIds: z.array(z.string()).default([]),
  shippingTotal: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(1).optional(),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).optional(),
  dueDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const invoiceUpdateSchema = z.object({
  columnConfig: z.object({ columns: z.array(z.string()) }).nullable().optional(),
  dueDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const designFeeChargeSchema = z.object({
  projectId: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().optional().or(z.literal('')),
});

// ---------- Business Development ----------

export const leadBoardSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const pipelineStageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  boardId: z.string().min(1),
});

export const pipelineStageUpdateSchema = z.object({
  name: z.string().min(1).optional(),
});

export const referralPartnerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  businessName: z.string().optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export const leadSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  projectType: z.string().optional().or(z.literal('')),
  referralSource: z.string().optional().or(z.literal('')),
  referralPartnerId: z.string().optional().or(z.literal('')),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  pipelineStageId: z.string().min(1),
  squareFootage: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).nullable()
  ),
  estimatedBudget: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).nullable()
  ),
  timeline: z.string().optional().or(z.literal('')),
  builderName: z.string().optional().or(z.literal('')),
  architectName: z.string().optional().or(z.literal('')),
});

export const leadUpdateSchema = leadSchema.partial();

export const leadMoveSchema = z.object({
  pipelineStageId: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

// ---------- Administration ----------

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
  name: z.string().min(1, 'Name is required'),
});

export const feeStructureOptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  scope: z.enum(['DESIGN_FEE', 'PROCUREMENT']),
});

export const procurementListSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, 'Name is required'),
});

export const procurementListUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

const fieldDefBaseSchema = z.object({
  label: z.string().min(1, 'Label is required'),
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

// ---------- Documents ----------

export const documentFolderSchema = z.object({
  projectId: z.string().min(1),
  folder: z.string().min(1, 'Folder is required'),
});
