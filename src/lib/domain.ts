// The app's own vocabulary.
//
// These values also exist as Prisma enums, because the database stores them —
// but the *meaning* belongs to the business, not the ORM. Importing
// `InvoiceType` from '@prisma/client' made a generated client the source of
// truth for a domain concept, and dragged an ORM import into modules that
// otherwise had no reason to know Prisma exists. Declared here, they're just
// strings, and Prisma checks them against the schema at the persistence edge.

export const INVOICE_TYPES = ['PROCUREMENT', 'DESIGN_FEE'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const FEE_STRUCTURE_SCOPES = ['DESIGN_FEE', 'PROCUREMENT'] as const;
export type FeeStructureScope = (typeof FEE_STRUCTURE_SCOPES)[number];

export const DOCUMENT_TYPES = ['PRESENTATION', 'VENDOR_INVOICE', 'CONTRACT', 'OTHER'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PAYMENT_CATEGORIES = ['MERCHANDISE', 'DESIGN_FEE'] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const PROJECT_STATUSES = ['LEAD', 'ACTIVE', 'ON_HOLD', 'COMPLETE'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const USER_ROLES = ['ADMIN', 'DESIGNER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}
