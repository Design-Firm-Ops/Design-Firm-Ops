import { prisma } from '@/server/prisma';
import type { ProjectStatus } from '@/lib/domain';

// Project reads.

/** The projects list, optionally narrowed to one status ("ALL" means no filter). */
export function listProjects(status: ProjectStatus | 'ALL') {
  return prisma.project.findMany({
    where: status === 'ALL' ? {} : { status },
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function listActiveProjects() {
  return prisma.project.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/** The lookup lists the "new project" form needs to populate its dropdowns. */
export function getNewProjectFormOptions() {
  return Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.feeStructureOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
  ]).then(([clients, projectTypes, feeStructureOptions]) => ({ clients, projectTypes, feeStructureOptions }));
}

/**
 * A whole project with everything its detail page renders. One question, one
 * round of includes — the page shouldn't be assembling this graph itself.
 */
export function getProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: { include: { contacts: { orderBy: { order: 'asc' } } } },
      projectType: true,
      designFeeStructure: true,
      procurementFeeStructure: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          fieldValues: true,
          invoice: { select: { invoiceNumber: true } },
          itemType: { select: { name: true } },
        },
      },
      procurementLists: { orderBy: { order: 'asc' } },
      rooms: { orderBy: { order: 'asc' } },
      documentFolders: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      invoices: { include: { items: true, designFeeCharges: true }, orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { date: 'desc' } },
      designFeeCharges: { include: { invoice: { select: { invoiceNumber: true } } }, orderBy: { date: 'desc' } },
      fieldValues: true,
    },
  });
}

/** The lookup lists the project detail page needs alongside the project itself. */
export function getProjectDetailOptions() {
  return Promise.all([
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.feeStructureOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemTypeOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemFieldDef.findMany({ orderBy: { order: 'asc' } }),
    prisma.projectFieldDef.findMany({ orderBy: { order: 'asc' } }),
  ]).then(([vendors, projectTypes, feeStructureOptions, itemTypeOptions, itemFieldDefs, projectFieldDefs]) => ({
    vendors,
    projectTypes,
    feeStructureOptions,
    itemTypeOptions,
    itemFieldDefs,
    projectFieldDefs,
  }));
}
