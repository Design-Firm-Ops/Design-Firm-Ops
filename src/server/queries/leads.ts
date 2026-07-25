import { prisma } from '@/server/prisma';

// Everything the Business Development board renders, as one question.

export function getBusinessDevelopmentData(firmId: string) {
  return Promise.all([
    prisma.leadBoard.findMany({ where: { firmId }, orderBy: { order: 'asc' } }),
    prisma.pipelineStage.findMany({ where: { firmId }, orderBy: { order: 'asc' } }),
    prisma.lead.findMany({
      where: { firmId },
      include: { projectType: true, referralPartner: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.referralPartner.findMany({
      where: { firmId },
      include: { _count: { select: { leads: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.projectType.findMany({ where: { firmId }, orderBy: { name: 'asc' }, select: { name: true } }),
  ]).then(([boards, stages, leads, referralPartners, projectTypes]) => ({
    boards,
    stages,
    leads,
    referralPartners,
    projectTypes,
  }));
}
