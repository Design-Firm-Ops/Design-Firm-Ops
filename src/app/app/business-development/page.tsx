import { prisma } from '@/lib/prisma';
import BusinessDevTabs from './BusinessDevTabs';
import LeadsBoard from './LeadsBoard';
import ReferralPartnersManager from './ReferralPartnersManager';

export const dynamic = 'force-dynamic';

export default async function BusinessDevelopmentPage() {
  const [stages, leads, referralPartners, projectTypes] = await Promise.all([
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
  ]);

  const leadRows = leads.map((l) => ({
    id: l.id,
    clientName: l.clientName,
    projectType: l.projectType?.name ?? null,
    referralSource: l.referralSource,
    referralPartnerId: l.referralPartnerId,
    referralPartnerName: l.referralPartner?.name ?? null,
    contactEmail: l.contactEmail,
    contactPhone: l.contactPhone,
    address: l.address,
    notes: l.notes,
    pipelineStageId: l.pipelineStageId,
    sortOrder: l.sortOrder,
    convertedProjectId: l.convertedProjectId,
    squareFootage: l.squareFootage,
    estimatedBudget: l.estimatedBudget ? String(l.estimatedBudget) : null,
    timeline: l.timeline,
    builderName: l.builderName,
    architectName: l.architectName,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-brown">Business Development</h1>
      <BusinessDevTabs
        leadsContent={
          <LeadsBoard
            initialStages={stages}
            initialLeads={leadRows}
            referralPartners={referralPartners.map((p) => ({ id: p.id, name: p.name }))}
            projectTypeOptions={projectTypes.map((t) => t.name)}
          />
        }
        referralPartnersContent={<ReferralPartnersManager initialPartners={referralPartners} />}
      />
    </div>
  );
}
