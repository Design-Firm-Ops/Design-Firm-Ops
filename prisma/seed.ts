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

const prisma = new PrismaClient();

async function seedUsers() {
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
      create: { email: u.email.toLowerCase(), passwordHash, name: u.name, role: u.role },
      update: { passwordHash, name: u.name, role: u.role },
    });
    console.log(`  user (${u.role}): ${u.email} / ${u.password}`);
  }
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
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
    },
    update: {},
  });
}

async function seedPipelineStages() {
  const existing = await prisma.pipelineStage.count();
  if (existing > 0) return;

  const stages = ['New Lead', 'Contacted', 'Proposal Sent', 'Won', 'Lost'];
  for (const [i, name] of stages.entries()) {
    await prisma.pipelineStage.create({ data: { name, order: i } });
  }
  console.log(`  pipeline stages: ${stages.join(', ')}`);
}

function mapEnum<T extends string>(value: string | null, allowed: T[]): T | null {
  if (!value) return null;
  const upper = value.toUpperCase() as T;
  return allowed.includes(upper) ? upper : null;
}

async function seedVendors() {
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

    await prisma.vendor.create({
      data: {
        name: v.name,
        website: v.website,
        showroomRep: v.showroomRep,
        accountType: mapEnum<'TRADE' | 'RETAIL' | 'BOTH'>(v.tradeRetail, ['TRADE', 'RETAIL', 'BOTH']),
        productType: mapEnum<'STOCK' | 'CUSTOM' | 'BOTH'>(v.stockCustom, ['STOCK', 'CUSTOM', 'BOTH']),
        priceRange: mapEnum<'LOW' | 'MID' | 'HIGH'>(v.priceRange, ['LOW', 'MID', 'HIGH']),
        offerings: v.offerings as (
          | 'FURNITURE'
          | 'OUTDOOR'
          | 'RUGS'
          | 'PILLOWS'
          | 'DECOR'
          | 'MIRRORS'
          | 'LAMPS'
          | 'BEDDING'
        )[],
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
async function clearDemoData() {
  await prisma.lead.updateMany({ where: { convertedProjectId: { not: null } }, data: { convertedProjectId: null } });

  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.designFeeCharge.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.vendor.deleteMany({});
}

async function seedDemoProject() {
  const client = await prisma.client.create({
    data: {
      name: 'Westland Reserve Development LLC',
      email: 'accounting@westlandreserve.com',
      phone: '(435) 555-0177',
      billingAddress: '88 Reserve Pointe, St. George, UT 84770',
      notes: 'Primary contact is the property manager, Dana Kowalski, for on-site access.',
    },
  });

  const projectType = await prisma.projectType.upsert({
    where: { name: 'Commercial Office' },
    create: { name: 'Commercial Office' },
    update: {},
  });

  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: 'Westland Reserve Red Rock Office',
      projectAddress: '1425 Red Rock Canyon Dr, St. George, UT 84770',
      status: 'ACTIVE',
      startDate: new Date('2025-04-01'),
      projectTypeId: projectType.id,
      leadDesignerName: 'Madison Ditton',
      feeStructure: 'COST_PLUS',
      feeNotes: '15% cost-plus on all merchandise; design fee billed hourly, invoiced separately.',
      defaultMarkupPct: 15,
      markupMode: 'MARKUP',
      salesTaxRate: 0.07,
      taxBase: 'MERCH_ONLY',
      invoicePrefix: '2506',
    },
  });

  // Small lighting-specific vendors for the demo line items — distinct
  // from the firm's real FF&E vendor list above, kept minimal since
  // their only role is to populate the Vendor column on these items.
  const [circa, visualComfort, rh, hinkley] = await Promise.all([
    prisma.vendor.create({ data: { name: 'Circa Lighting', website: 'https://circalighting.com', showroomRep: 'Ellen Marsh · ellen@circalighting.com' } }),
    prisma.vendor.create({ data: { name: 'Visual Comfort & Co.', website: 'https://visualcomfort.com', showroomRep: 'Derek Paulson · derek@visualcomfort.com' } }),
    prisma.vendor.create({ data: { name: 'RH Lighting', website: 'https://rh.com', showroomRep: 'Casey Nguyen · casey@rh.com' } }),
    prisma.vendor.create({ data: { name: 'Hinkley Lighting', website: 'https://hinkley.com', showroomRep: 'Marcus Tell · marcus@hinkley.com' } }),
  ]);

  // Unit costs solved so the 13-item extended-price sum matches the
  // reference subtotal exactly at the project's 15% default markup.
  const items = [
    { tag: 'LT-1', name: 'Bordeaux Sconce', room: 'Reception', vendor: circa, qty: 4, unitCost: '210.00', finish: 'Antique Brass', dimensions: '6"W x 12"H' },
    { tag: 'LT-2', name: 'Marchetti Pendant', room: 'Conference Room', vendor: visualComfort, qty: 2, unitCost: '685.00', finish: 'Bronze', dimensions: '18" dia' },
    { tag: 'LT-3', name: 'Axis Linear Suspension', room: 'Conference Room', vendor: visualComfort, qty: 1, unitCost: '1240.00', finish: 'Matte Black', dimensions: "72\"L" },
    { tag: 'LT-4', name: 'Circa Table Lamp', room: "Principal's Office", vendor: circa, qty: 3, unitCost: '320.00', finish: 'Alabaster', dimensions: '14"W x 26"H' },
    { tag: 'LT-5', name: 'Halo Recessed Downlight', room: 'Open Office', vendor: hinkley, qty: 12, unitCost: '48.00', finish: 'White Trim', dimensions: '4" aperture' },
    { tag: 'LT-6', name: 'Verona Chandelier', room: 'Reception', vendor: circa, qty: 1, unitCost: '2450.00', finish: 'Aged Iron', dimensions: '36" dia x 40"H' },
    { tag: 'LT-7', name: 'Nomad Floor Lamp', room: 'Lounge', vendor: rh, qty: 2, unitCost: '415.00', finish: 'Blackened Steel', dimensions: '20"W x 62"H' },
    { tag: 'LT-8', name: 'Cortina Wall Wash', room: 'Corridor', vendor: hinkley, qty: 6, unitCost: '96.00', finish: 'Bronze', dimensions: '5"W x 9"H' },
    { tag: 'LT-9', name: 'Solstice Picture Light', room: 'Lounge', vendor: visualComfort, qty: 3, unitCost: '175.00', finish: 'Brass', dimensions: '18"L' },
    { tag: 'LT-10', name: 'Ridgeline Outdoor Sconce', room: 'Exterior Entry', vendor: hinkley, qty: 4, unitCost: '130.00', finish: 'Textured Black', dimensions: '8"W x 14"H' },
    { tag: 'LT-11', name: 'Aria Cove Light Strip', room: "Principal's Office", vendor: rh, qty: 1, unitCost: '540.00', finish: 'N/A', dimensions: '16ft run' },
    { tag: 'LT-12', name: 'Belmont Library Lamp', room: 'Lounge', vendor: rh, qty: 2, unitCost: '260.00', finish: 'Antique Nickel', dimensions: '12"W x 24"H' },
    { tag: 'LT-13', name: 'Meridian Statement Chandelier', room: 'Reception', vendor: circa, qty: 1, unitCost: '5825.04', finish: 'Polished Brass', dimensions: '54" dia x 48"H' },
  ];

  const statuses = ['APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'PROPOSED', 'APPROVED', 'APPROVED', 'APPROVED'];

  let sortOrder = 1;
  for (const [i, item] of items.entries()) {
    await prisma.item.create({
      data: {
        projectId: project.id,
        tag: item.tag,
        name: item.name,
        category: 'LIGHTING',
        room: item.room,
        vendorId: item.vendor.id,
        qty: item.qty,
        unitCost: item.unitCost,
        finish: item.finish,
        dimensions: item.dimensions,
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
    data: { projectId: project.id, description: 'Design fee — phase 1', amount: '4500.00', date: new Date('2025-04-15') },
  });
  await prisma.payment.create({
    data: { projectId: project.id, category: 'DESIGN_FEE', amount: '2000.00', method: 'ACH', date: new Date('2025-04-20') },
  });

  console.log(`  client: ${client.name}`);
  console.log(`  project: ${project.name} (${items.length} items)`);
}

async function main() {
  console.log('Seeding MDI Studio...');
  await seedUsers();
  await seedSettings();
  await seedPipelineStages();
  await clearDemoData();
  await seedVendors();
  await seedDemoProject();
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
