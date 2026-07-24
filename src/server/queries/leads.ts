import { prisma } from '@/server/prisma';

// Everything the Business Development board renders, as one question.

export function getBusinessDevelopmentData() {
  return Promise.all([
    prisma.leadBoard.findMany({ orderBy: { order: 'asc' } }),
    prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } }),
    prisma.lead.findMany({
      include: { projectType: true, referralPartner: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.referralPartner.findMany({
      include: { _count: { select: { leads: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.projectType.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
  ]).then(([boards, stages, leads, referralPartners, projectTypes]) => ({
    boards,
    stages,
    leads,
    referralPartners,
    projectTypes,
  }));
}
