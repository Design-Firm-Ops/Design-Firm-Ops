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
  showroomRep: z.string().optional().or(z.literal('')),
  accountType: z.enum(['TRADE', 'RETAIL', 'BOTH']).nullable().optional(),
  productType: z.enum(['STOCK', 'CUSTOM', 'BOTH']).nullable().optional(),
  priceRange: z.enum(['LOW', 'MID', 'HIGH']).nullable().optional(),
  offerings: z
    .array(z.enum(['FURNITURE', 'OUTDOOR', 'RUGS', 'PILLOWS', 'DECOR', 'MIRRORS', 'LAMPS', 'BEDDING']))
    .default([]),
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
  feeStructure: z.enum(['FLAT_FEE', 'HOURLY', 'COST_PLUS', 'HYBRID']).default('COST_PLUS'),
  feeNotes: z.string().optional().or(z.literal('')),
  defaultMarkupPct: z.coerce.number().min(0).max(1000).default(15),
  markupMode: z.enum(['MARKUP', 'MARGIN']).default('MARKUP'),
  salesTaxRate: z.coerce.number().min(0).max(1).default(0),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).default('MERCH_ONLY'),
  invoicePrefix: z.string().optional().or(z.literal('')),
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

export const itemUpdateSchema = itemSchema.partial().omit({ projectId: true });

export const settingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyAddress: z.string().optional().or(z.literal('')),
  owner1Name: z.string().optional().or(z.literal('')),
  owner1Contact: z.string().optional().or(z.literal('')),
  owner2Name: z.string().optional().or(z.literal('')),
  owner2Contact: z.string().optional().or(z.literal('')),
  paymentInstructions: z.string().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
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

export const invoiceCreateSchema = z.object({
  projectId: z.string().min(1),
  itemIds: z.array(z.string()).min(1, 'Select at least one item'),
  shippingTotal: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(1).optional(),
  taxBase: z.enum(['MERCH_ONLY', 'MERCH_PLUS_SHIPPING']).optional(),
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

export const pipelineStageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
