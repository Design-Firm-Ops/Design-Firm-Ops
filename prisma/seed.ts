// Seed script.
//
// Seeds: 2 owner accounts (ADMIN) + 1 demo designer account (DESIGNER,
// for exercising permission gating), company settings, default CRM
// pipeline stages, the real 65-vendor FF&E list from the firm's
// spreadsheet, and a demo project ("Westland Reserve Red Rock Office")
// with 13 lighting line items that reproduce the reference invoice
// numbers exactly:
//   13 items, subtotal $19,287.85, shipping $2,295.48,
//   7% tax $1,350.15, grand total $22,933.48

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptSecret } from '../src/lib/crypto';
import { RAW_VENDORS } from './vendorData';
import { seedSuperAdmin } from '../src/server/superAdmin';
import { applyFirmDefaults } from '../src/server/provisionFirm';

const prisma = new PrismaClient();

/// The demo tenant. Everything else the seed creates hangs off this firm —
/// the app is multi-tenant now, so nothing is created "globally".
async function seedFirm() {
  const firm = await prisma.firm.upsert({
    where: { slug: 'madison-ditton-interiors' },
    create: { name: 'Madison Ditton Interiors', slug: 'madison-ditton-interiors', status: 'ACTIVE' },
    update: {},
  });
  console.log(`  firm: ${firm.name} (${firm.slug})`);
  return firm.id;
}

async function seedUsers(firmId: string) {
  const users = [
    {
      email: process.env.SEED_OWNER1_EMAIL ?? 'madison@mditerior.com',
      password: process.env.SEED_OWNER1_PASSWORD ?? 'ChangeMe123!',
      name: 'Madison Ditton',
      role: 'ADMIN' as const,
    },
    {
      email: process.env.SEED_OWNER2_EMAIL ?? 'owner2@mditerior.com',
      password: process.env.SEED_OWNER2_PASSWORD ?? 'ChangeMe123!',
      name: 'Studio Owner',
      role: 'ADMIN' as const,
    },
    {
      email: process.env.SEED_DESIGNER_EMAIL ?? 'designer@mditerior.com',
      password: process.env.SEED_DESIGNER_PASSWORD ?? 'ChangeMe123!',
      name: 'Sample Designer',
      role: 'DESIGNER' as const,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      create: { email: u.email.toLowerCase(), passwordHash, name: u.name, role: u.role, firmId },
      update: { passwordHash, name: u.name, role: u.role, firmId },
    });
    console.log(`  user (${u.role}): ${u.email} / ${u.password}`);
  }
}

async function seedSettings(firmId: string) {
  const demoSettings = {
    companyName: 'Madison Ditton Interiors',
    companyAddress: '212 Main Street, Park City, UT 84060',
    owner1Name: 'Madison Ditton',
    owner1Contact: 'madison@mditerior.com · (435) 555-0110',
    owner2Name: 'Studio Owner',
    owner2Contact: 'owner2@mditerior.com · (435) 555-0111',
    paymentInstructions:
      '<p><strong>ACH / Wire</strong><br/>Bank: Zions Bank<br/>Routing: 124000054<br/>Account: 0123456789</p>' +
      '<p><strong>Chase Bill Pay</strong><br/>Payee: Madison Ditton Interiors LLC</p>' +
      '<p>Checks payable to Madison Ditton Interiors LLC.</p>',
  };

  await prisma.settings.upsert({
    where: { firmId },
    create: { firmId, ...demoSettings },
    // Re-asserted rather than left alone: applyFirmDefaults creates this row
    // with just the firm name, so the demo details have to be layered on top.
    update: demoSettings,
  });
}

function mapEnum<T extends string>(value: string | null, allowed: T[]): T | null {
  if (!value) return null;
  const upper = value.toUpperCase() as T;
  return allowed.includes(upper) ? upper : null;
}

const PLACE_WORDS = new Set([
  'trade', 'home', 'studio', 'rug', 'rugs', 'city', 'point', 'como', 'royale', 'regency',
  'vintage', 'shop', 'online', 'slc', 'vegas', 'denver', 'la', 'curate', 'the', 'to', 'and',
  'high', 'luxe', 'ivystone', 'park', 'furniture', 'collection', '&',
]);

function looksLikePersonName(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (/\d/.test(text)) return false;
  return words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w) && !PLACE_WORDS.has(w.toLowerCase()));
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;

/**
 * Best-effort split of the firm's freeform "showroom / rep" spreadsheet
 * text into structured fields. The source data mixes showroom name, rep
 * name, email, and phone with no consistent delimiter, so this is a
 * heuristic — admins can correct individual vendors after seeding.
 */
function parseShowroomRep(raw: string | null): {
  showroomName: string | null;
  repName: string | null;
  repEmail: string | null;
  repPhone: string | null;
} {
  if (!raw) return { showroomName: null, repName: null, repEmail: null, repPhone: null };

  const lines = raw
    .split('\n')
    .flatMap((line) => line.split('·'))
    .flatMap((line) => (EMAIL_RE.test(line) || PHONE_RE.test(line) ? [line] : line.split(',')))
    .map((s) => s.trim())
    .filter(Boolean);

  let repEmail: string | null = null;
  let repPhone: string | null = null;
  const texts: string[] = [];

  for (const line of lines) {
    const emailMatch = line.match(EMAIL_RE);
    const phoneMatch = line.match(PHONE_RE);
    if (emailMatch && !repEmail) {
      repEmail = emailMatch[0];
      continue;
    }
    if (phoneMatch && !repPhone) {
      repPhone = phoneMatch[0];
      continue;
    }
    if (!emailMatch && !phoneMatch) texts.push(line);
  }

  let showroomName: string | null = null;
  let repName: string | null = null;

  if (texts.length === 1) {
    if (looksLikePersonName(texts[0])) repName = texts[0];
    else showroomName = texts[0];
  } else if (texts.length >= 2) {
    showroomName = texts.slice(0, -1).join(' / ');
    repName = texts[texts.length - 1];
  }

  return { showroomName, repName, repEmail, repPhone };
}

async function seedVendors(firmId: string) {
  let withCredentials = 0;

  for (const v of RAW_VENDORS) {
    let tradeAccountNotes: string | null = null;
    let tradeAccountPasswordEncrypted: string | null = null;

    // Treat any login text that mentions a password as sensitive —
    // encrypt the whole blob rather than trying to parse it apart.
    // Non-credential status text ("no login, quotes through rep",
    // "application pending") is kept as plain notes.
    if (v.login) {
      if (v.login.toLowerCase().includes('password')) {
        tradeAccountPasswordEncrypted = encryptSecret(v.login);
        withCredentials++;
      } else {
        tradeAccountNotes = v.login;
      }
    }

    const { showroomName, repName, repEmail, repPhone } = parseShowroomRep(v.showroomRep);

    await prisma.vendor.create({
      data: {
        firmId,
        name: v.name,
        website: v.website,
        showroomName,
        repName,
        repEmail,
        repPhone,
        accountType: mapEnum<'TRADE' | 'RETAIL' | 'BOTH'>(v.tradeRetail, ['TRADE', 'RETAIL', 'BOTH']),
        productType: mapEnum<'STOCK' | 'CUSTOM' | 'BOTH'>(v.stockCustom, ['STOCK', 'CUSTOM', 'BOTH']),
        priceRange: mapEnum<'LOW' | 'MID' | 'HIGH'>(v.priceRange, ['LOW', 'MID', 'HIGH']),
        offerings: {
          connect: v.offerings.map((o) => ({
            firmId_name: { firmId, name: o.charAt(0) + o.slice(1).toLowerCase() },
          })),
        },
        notes: v.notes,
        tradeAccountNotes,
        tradeAccountPasswordEncrypted,
      },
    });
  }

  console.log(`  vendors: ${RAW_VENDORS.length} imported (${withCredentials} with encrypted trade credentials)`);
}

// Clears prior demo business data so this script can be re-run safely.
// Leads/referral partners/pipeline stages are treated as persistent
// business data, not demo data, so they're never cleared here — only
// unlinked from a project about to be deleted.
async function clearDemoData(firmId: string) {
  await prisma.lead.updateMany({ where: { convertedProjectId: { not: null } }, data: { convertedProjectId: null } });

  await prisma.payment.deleteMany({ where: { firmId } });
  await prisma.invoice.deleteMany({ where: { firmId } });
  await prisma.item.deleteMany({ where: { firmId } });
  // Only clear project-scoped documents — lead-attached documents
  // (projectId null, leadId set) are persistent business data, same as
  // leads themselves, and must survive a re-seed.
  await prisma.document.deleteMany({ where: { projectId: { not: null } } });
  await prisma.designFeeCharge.deleteMany({ where: { project: { firmId } } });
  await prisma.project.deleteMany({ where: { firmId } });
  await prisma.client.deleteMany({ where: { firmId } });
  await prisma.vendor.deleteMany({ where: { firmId } });
}

async function seedDemoProject(firmId: string) {
  const client = await prisma.client.create({
    data: {
      firmId,
      name: 'Westland Reserve Development LLC',
      email: 'accounting@westlandreserve.com',
      phone: '(435) 555-0177',
      billingAddress: '88 Reserve Pointe, St. George, UT 84770',
      notes: 'Primary contact is the property manager, Dana Kowalski, for on-site access.',
    },
  });

  const projectType = await prisma.projectType.upsert({
    where: { firmId_name: { firmId, name: 'Commercial Office' } },
    create: { name: 'Commercial Office', firmId },
    update: {},
  });

  const [designFeeStructure, procurementFeeStructure] = await Promise.all([
    prisma.feeStructureOption.upsert({
      where: { firmId_scope_name: { firmId, scope: 'DESIGN_FEE', name: 'Hourly' } },
      create: { scope: 'DESIGN_FEE', name: 'Hourly', order: 1, firmId },
      update: {},
    }),
    prisma.feeStructureOption.upsert({
      where: { firmId_scope_name: { firmId, scope: 'PROCUREMENT', name: 'Cost Plus' } },
      create: { scope: 'PROCUREMENT', name: 'Cost Plus', order: 0, firmId },
      update: {},
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      firmId,
      name: 'Westland Reserve Red Rock Office',
      projectAddress: '1425 Red Rock Canyon Dr, St. George, UT 84770',
      status: 'ACTIVE',
      startDate: new Date('2025-04-01'),
      projectTypeId: projectType.id,
      leadDesignerName: 'Madison Ditton',
      designFeeStructureId: designFeeStructure.id,
      procurementFeeStructureId: procurementFeeStructure.id,
      feeNotes: '15% cost-plus on all merchandise; design fee billed hourly, invoiced separately.',
      defaultMarkupPct: 15,
      markupMode: 'MARKUP',
      salesTaxRate: 0.07,
      taxBase: 'MERCH_ONLY',
      invoicePrefix: '2506',
    },
  });

  const procurementLists = await Promise.all(
    ['Lighting', 'Furniture', 'Decor', 'Materials', 'Other Merchandise'].map((name, order) =>
      prisma.procurementList.create({ data: { projectId: project.id, name, order, firmId } })
    )
  );
  const lightingList = procurementLists[0];

  await prisma.projectDocumentFolder.createMany({
    data: ['Outside Design Documents', 'Notes and Markups', 'Precedent Images', 'Presentations', 'Drawings'].map(
      (name, order) => ({ projectId: project.id, name, order, firmId })
    ),
  });

  // Small lighting-specific vendors for the demo line items — distinct
  // from the firm's real FF&E vendor list above, kept minimal since
  // their only role is to populate the Vendor column on these items.
  const [circa, visualComfort, rh, hinkley] = await Promise.all([
    prisma.vendor.create({ data: { firmId, name: 'Circa Lighting', website: 'https://circalighting.com', repName: 'Ellen Marsh', repEmail: 'ellen@circalighting.com' } }),
    prisma.vendor.create({ data: { firmId, name: 'Visual Comfort & Co.', website: 'https://visualcomfort.com', repName: 'Derek Paulson', repEmail: 'derek@visualcomfort.com' } }),
    prisma.vendor.create({ data: { firmId, name: 'RH Lighting', website: 'https://rh.com', repName: 'Casey Nguyen', repEmail: 'casey@rh.com' } }),
    prisma.vendor.create({ data: { firmId, name: 'Hinkley Lighting', website: 'https://hinkley.com', repName: 'Marcus Tell', repEmail: 'marcus@hinkley.com' } }),
  ]);

  // Unit costs solved so the 13-item extended-price sum matches the
  // reference subtotal exactly at the project's 15% default markup.
  // height/width/length are a best-effort read of the original
  // freeform dimension text (still preserved verbatim as
  // legacyDimensionsNote); itemType is left unset where the product
  // doesn't match one of the seeded Lighting item types.
  const items = [
    { tag: 'LT-1', name: 'Bordeaux Sconce', room: 'Reception', vendor: circa, qty: 4, unitCost: '210.00', finish: 'Antique Brass', dimensions: '6"W x 12"H', width: 6, height: 12, itemType: 'Sconce' },
    { tag: 'LT-2', name: 'Marchetti Pendant', room: 'Conference Room', vendor: visualComfort, qty: 2, unitCost: '685.00', finish: 'Bronze', dimensions: '18" dia', width: 18, length: 18, itemType: 'Pendant' },
    { tag: 'LT-3', name: 'Axis Linear Suspension', room: 'Conference Room', vendor: visualComfort, qty: 1, unitCost: '1240.00', finish: 'Matte Black', dimensions: "72\"L", length: 72, itemType: null },
    { tag: 'LT-4', name: 'Circa Table Lamp', room: "Principal's Office", vendor: circa, qty: 3, unitCost: '320.00', finish: 'Alabaster', dimensions: '14"W x 26"H', width: 14, height: 26, itemType: 'Table Lamp' },
    { tag: 'LT-5', name: 'Halo Recessed Downlight', room: 'Open Office', vendor: hinkley, qty: 12, unitCost: '48.00', finish: 'White Trim', dimensions: '4" aperture', width: 4, itemType: null },
    { tag: 'LT-6', name: 'Verona Chandelier', room: 'Reception', vendor: circa, qty: 1, unitCost: '2450.00', finish: 'Aged Iron', dimensions: '36" dia x 40"H', width: 36, length: 36, height: 40, itemType: 'Chandelier' },
    { tag: 'LT-7', name: 'Nomad Floor Lamp', room: 'Lounge', vendor: rh, qty: 2, unitCost: '415.00', finish: 'Blackened Steel', dimensions: '20"W x 62"H', width: 20, height: 62, itemType: 'Floor Lamp' },
    { tag: 'LT-8', name: 'Cortina Wall Wash', room: 'Corridor', vendor: hinkley, qty: 6, unitCost: '96.00', finish: 'Bronze', dimensions: '5"W x 9"H', width: 5, height: 9, itemType: null },
    { tag: 'LT-9', name: 'Solstice Picture Light', room: 'Lounge', vendor: visualComfort, qty: 3, unitCost: '175.00', finish: 'Brass', dimensions: '18"L', length: 18, itemType: null },
    { tag: 'LT-10', name: 'Ridgeline Outdoor Sconce', room: 'Exterior Entry', vendor: hinkley, qty: 4, unitCost: '130.00', finish: 'Textured Black', dimensions: '8"W x 14"H', width: 8, height: 14, itemType: 'Sconce' },
    { tag: 'LT-11', name: 'Aria Cove Light Strip', room: "Principal's Office", vendor: rh, qty: 1, unitCost: '540.00', finish: 'N/A', dimensions: '16ft run', length: 192, itemType: null },
    { tag: 'LT-12', name: 'Belmont Library Lamp', room: 'Lounge', vendor: rh, qty: 2, unitCost: '260.00', finish: 'Antique Nickel', dimensions: '12"W x 24"H', width: 12, height: 24, itemType: 'Table Lamp' },
    { tag: 'LT-13', name: 'Meridian Statement Chandelier', room: 'Reception', vendor: circa, qty: 1, unitCost: '5825.04', finish: 'Polished Brass', dimensions: '54" dia x 48"H', width: 54, length: 54, height: 48, itemType: 'Chandelier' },
  ];

  const statuses = ['APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'APPROVED'];

  const lightingTypes = await prisma.itemTypeOption.findMany({ where: { firmId, category: 'Lighting' } });
  const lightingTypeIdByName = new Map(lightingTypes.map((t) => [t.name, t.id]));

  let sortOrder = 1;
  for (const [i, item] of items.entries()) {
    await prisma.item.create({
      data: {
        projectId: project.id,
        firmId,
        tag: item.tag,
        name: item.name,
        category: 'Lighting',
        itemTypeId: item.itemType ? lightingTypeIdByName.get(item.itemType) ?? null : null,
        room: item.room,
        vendorId: item.vendor.id,
        procurementListId: lightingList.id,
        qty: item.qty,
        unitCost: item.unitCost,
        finish: item.finish,
        legacyDimensionsNote: item.dimensions,
        dimensionHeight: item.height ?? null,
        dimensionWidth: item.width ?? null,
        dimensionLength: item.length ?? null,
        status: statuses[i] as
          | 'PROPOSED'
          | 'APPROVED'
          | 'INVOICED'
          | 'ORDERED'
          | 'RECEIVED'
          | 'DELIVERED',
        sortOrder: sortOrder++,
      },
    });
  }

  // A design fee charge/payment so the overview's Design Fee ledger
  // has something to show out of the box.
  await prisma.designFeeCharge.create({
    data: { projectId: project.id, firmId, description: 'Design fee — phase 1', amount: '4500.00', date: new Date('2025-04-15') },
  });
  await prisma.payment.create({
    data: { projectId: project.id, firmId, category: 'DESIGN_FEE', amount: '2000.00', method: 'ACH', date: new Date('2025-04-20') },
  });

  console.log(`  client: ${client.name}`);
  console.log(`  project: ${project.name} (${items.length} items)`);
}

async function main() {
  console.log('Seeding Design Firm Ops...');

  const superAdmin = await seedSuperAdmin(prisma);
  if (superAdmin.status === 'skipped') {
    console.log(`  super-admin: skipped (${superAdmin.reason})`);
  } else {
    console.log(`  super-admin: ${superAdmin.email} (${superAdmin.created ? 'created' : 'updated'})`);
  }

  const firmId = await seedFirm();

  // The demo tenant gets its baseline lookups from the same definition a real
  // sign-up uses, so the two cannot drift (DES-28). It can't be *provisioned*,
  // because the multi-tenancy migration creates this firm on every database —
  // but it can share the defaults, which is the part that matters.
  await applyFirmDefaults(prisma, firmId, 'Madison Ditton Interiors');
  console.log('  defaults: offerings, fee structures, item types, lead pipeline');

  await seedUsers(firmId);
  await seedSettings(firmId);
  await clearDemoData(firmId);
  await seedVendors(firmId);
  await seedDemoProject(firmId);
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
