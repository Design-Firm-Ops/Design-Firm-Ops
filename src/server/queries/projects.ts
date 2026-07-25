import { prisma } from '@/server/prisma';
import type { ProjectStatus } from '@/lib/domain';

// Project reads.

/** The projects list, optionally narrowed to one status ("ALL" means no filter). */
export function listProjects(firmId: string, status: ProjectStatus | 'ALL') {
  return prisma.project.findMany({
    where: status === 'ALL' ? { firmId } : { firmId, status },
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function listActiveProjects(firmId: string) {
  return prisma.project.findMany({
    where: { firmId, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/** The lookup lists the "new project" form needs to populate its dropdowns. */
export function getNewProjectFormOptions(firmId: string) {
  return Promise.all([
    prisma.client.findMany({ where: { firmId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ where: { firmId }, orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.feeStructureOption.findMany({ where: { firmId }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
  ]).then(([clients, projectTypes, feeStructureOptions]) => ({ clients, projectTypes, feeStructureOptions }));
}

/**
 * A whole project with everything its detail page renders. One question, one
 * round of includes — the page shouldn't be assembling this graph itself.
 */
export function getProjectDetail(id: string, firmId: string) {
  return prisma.project.findFirst({
    where: { id, firmId },
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
export function getProjectDetailOptions(firmId: string) {
  return Promise.all([
    prisma.vendor.findMany({ where: { firmId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ where: { firmId }, orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.feeStructureOption.findMany({ where: { firmId }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemTypeOption.findMany({ where: { firmId }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    prisma.itemFieldDef.findMany({ where: { firmId }, orderBy: { order: 'asc' } }),
    prisma.projectFieldDef.findMany({ where: { firmId }, orderBy: { order: 'asc' } }),
  ]).then(([vendors, projectTypes, feeStructureOptions, itemTypeOptions, itemFieldDefs, projectFieldDefs]) => ({
    vendors,
    projectTypes,
    feeStructureOptions,
    itemTypeOptions,
    itemFieldDefs,
    projectFieldDefs,
  }));
}
