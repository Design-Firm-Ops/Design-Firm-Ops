// Seed script — 2 internal users, 1 client, 1 project
// ("Westland Reserve Red Rock Office") with 13 lighting line items that
// reproduce the reference invoice numbers exactly:
//   13 items, subtotal $19,287.85, shipping $2,295.48,
//   7% tax $1,350.15, grand total $22,933.48

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedUsers() {
  const users = [
    {
      email: process.env.SEED_OWNER1_EMAIL ?? 'madison@mditerior.com',
      password: process.env.SEED_OWNER1_PASSWORD ?? 'ChangeMe123!',
      name: 'Madison Ditton',
    },
    {
      email: process.env.SEED_OWNER2_EMAIL ?? 'owner2@mditerior.com',
      password: process.env.SEED_OWNER2_PASSWORD ?? 'ChangeMe123!',
      name: 'Studio Owner',
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      create: { email: u.email.toLowerCase(), passwordHash, name: u.name },
      update: { passwordHash, name: u.name },
    });
    console.log(`  user: ${u.email} / ${u.password}`);
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

// Clears prior demo business data so this script can be re-run safely.
async function clearDemoData() {
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.document.deleteMany({});
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

  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: 'Westland Reserve Red Rock Office',
      projectAddress: '1425 Red Rock Canyon Dr, St. George, UT 84770',
      status: 'ACTIVE',
      startDate: new Date('2025-04-01'),
      feeStructure: 'COST_PLUS',
      feeNotes: '15% cost-plus on all merchandise; design fee billed hourly, invoiced separately.',
      defaultMarkupPct: 15,
      markupMode: 'MARKUP',
      salesTaxRate: 0.07,
      taxBase: 'MERCH_ONLY',
      invoicePrefix: '2506',
    },
  });

  const [circa, visualComfort, rh, hinkley] = await Promise.all([
    prisma.vendor.create({
      data: { name: 'Circa Lighting', website: 'https://circalighting.com', repName: 'Ellen Marsh', repEmail: 'ellen@circalighting.com' },
    }),
    prisma.vendor.create({
      data: { name: 'Visual Comfort & Co.', website: 'https://visualcomfort.com', repName: 'Derek Paulson', repEmail: 'derek@visualcomfort.com' },
    }),
    prisma.vendor.create({
      data: { name: 'RH Lighting', website: 'https://rh.com', repName: 'Casey Nguyen', repEmail: 'casey@rh.com' },
    }),
    prisma.vendor.create({
      data: { name: 'Hinkley Lighting', website: 'https://hinkley.com', repName: 'Marcus Tell', repEmail: 'marcus@hinkley.com' },
    }),
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

  console.log(`  client: ${client.name}`);
  console.log(`  project: ${project.name} (${items.length} items)`);
}

async function main() {
  console.log('Seeding MDI Studio...');
  await seedUsers();
  await seedSettings();
  await clearDemoData();
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
