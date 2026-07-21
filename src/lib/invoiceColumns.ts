// Which columns an invoice's PDF/portal render shows the client. Never
// includes vendor name or internal notes — those aren't in this list at
// all, so there's no config that can expose them.

export const INVOICE_COLUMNS = ['image', 'tag', 'description', 'qty', 'unitCost', 'unitPrice', 'extended'] as const;
export type InvoiceColumnKey = (typeof INVOICE_COLUMNS)[number];

export interface InvoiceColumnConfig {
  columns: InvoiceColumnKey[];
}

export const COLUMN_LABELS: Record<InvoiceColumnKey, string> = {
  image: 'Photo',
  tag: 'Tag',
  description: 'Description',
  qty: 'Qty',
  unitCost: 'Unit $ (cost)',
  unitPrice: 'Unit $ (marked up)',
  extended: 'Extended $',
};

export const COLUMN_PRESETS: Record<string, { label: string; config: InvoiceColumnConfig }> = {
  transparent: {
    label: 'Show markup transparently',
    config: { columns: ['tag', 'description', 'qty', 'unitCost', 'unitPrice', 'extended'] },
  },
  priceOnly: {
    label: 'Price only',
    config: { columns: ['description', 'qty', 'unitPrice', 'extended'] },
  },
  minimal: {
    label: 'Minimal',
    config: { columns: ['description', 'qty', 'extended'] },
  },
};

const DEFAULT_CONFIG: InvoiceColumnConfig = COLUMN_PRESETS.transparent.config;

function isValidConfig(value: unknown): value is InvoiceColumnConfig {
  if (!value || typeof value !== 'object') return false;
  const columns = (value as { columns?: unknown }).columns;
  return Array.isArray(columns) && columns.every((c) => (INVOICE_COLUMNS as readonly string[]).includes(c));
}

/** Resolves the effective column config: invoice override -> project default -> built-in default. */
export function resolveColumnConfig(
  invoiceColumnConfig: unknown,
  projectDefaultColumnConfig?: unknown
): InvoiceColumnConfig {
  if (isValidConfig(invoiceColumnConfig)) return invoiceColumnConfig;
  if (isValidConfig(projectDefaultColumnConfig)) return projectDefaultColumnConfig;
  return DEFAULT_CONFIG;
}
