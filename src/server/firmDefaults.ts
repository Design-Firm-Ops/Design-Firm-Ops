// What a new firm starts with.
//
// These lists used to exist only as one-time INSERTs inside migrations, run
// against the single firm that existed at the time (see the DES-28 plan). That
// worked while there was one tenant and nothing else could ever be created;
// it means a firm provisioned at runtime would get *none* of them.
//
// Lifted here so "what does a new firm get" is one readable list rather than an
// archaeology exercise across four migration files. `firmDefaults.test.ts`
// compares these against the migration SQL, so new tenants can't silently
// differ from the original one.

export const DEFAULT_OFFERINGS: readonly string[] = [
  'Furniture',
  'Outdoor',
  'Rugs',
  'Pillows',
  'Decor',
  'Mirrors',
  'Lamps',
  'Bedding',
];

export interface FeeStructureDefault {
  name: string;
  scope: 'DESIGN_FEE' | 'PROCUREMENT';
}

// Note the asymmetry: PROCUREMENT offers Cost Plus and DESIGN_FEE does not.
// That's faithful to the product decision, not an omission — the migration
// inserted design-fee Cost Plus *conditionally*, only for firms that already
// had a cost-plus project, so it was a backfill rather than a default. These
// are customizable taxonomies; a firm that wants it can add it.
export const DEFAULT_FEE_STRUCTURES: readonly FeeStructureDefault[] = [
  { name: 'Fixed Fee', scope: 'DESIGN_FEE' },
  { name: 'Hourly', scope: 'DESIGN_FEE' },
  { name: 'Cost Plus', scope: 'PROCUREMENT' },
  { name: 'Fixed Fee', scope: 'PROCUREMENT' },
  { name: 'Hourly', scope: 'PROCUREMENT' },
];

export interface ItemTypeDefault {
  category: string;
  name: string;
  tagPrefix: string;
}

export const DEFAULT_ITEM_TYPES: readonly ItemTypeDefault[] = [
  { category: 'Lighting', name: 'Chandelier', tagPrefix: 'CD' },
  { category: 'Lighting', name: 'Pendant', tagPrefix: 'PD' },
  { category: 'Lighting', name: 'Sconce', tagPrefix: 'SC' },
  { category: 'Lighting', name: 'Flush Mount', tagPrefix: 'FM' },
  { category: 'Lighting', name: 'Table Lamp', tagPrefix: 'TL' },
  { category: 'Lighting', name: 'Floor Lamp', tagPrefix: 'FL' },
  { category: 'Furniture', name: 'Sofa', tagPrefix: 'SF' },
  { category: 'Furniture', name: 'Chair', tagPrefix: 'CH' },
  { category: 'Furniture', name: 'Table', tagPrefix: 'TA' },
  { category: 'Furniture', name: 'Rug', tagPrefix: 'RG' },
  { category: 'Furniture', name: 'Bed', tagPrefix: 'BD' },
  { category: 'Furniture', name: 'Case Good', tagPrefix: 'CG' },
  { category: 'Furniture', name: 'Ottoman', tagPrefix: 'OT' },
];

/** The default lead board, and the pipeline every new firm starts with. */
export const DEFAULT_LEAD_BOARD = 'Leads';

export const DEFAULT_PIPELINE_STAGES: readonly string[] = [
  'New Lead',
  'Contacted',
  'Proposal Sent',
  'Won',
  'Lost',
];
