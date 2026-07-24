import { getBusinessDevelopmentData } from '@/server/queries/leads';
import BusinessDevTabs from './BusinessDevTabs';
import ReferralPartnersManager from './ReferralPartnersManager';

export const dynamic = 'force-dynamic';

export default async function BusinessDevelopmentPage() {
  const { boards, stages, leads, referralPartners, projectTypes } = await getBusinessDevelopmentData();

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

  const boardData = boards.map((board) => {
    const boardStages = stages.filter((s) => s.boardId === board.id);
    const stageIds = new Set(boardStages.map((s) => s.id));
    return {
      id: board.id,
      name: board.name,
      stages: boardStages,
      leads: leadRows.filter((l) => stageIds.has(l.pipelineStageId)),
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-brown">Business Development</h1>
      <BusinessDevTabs
        boards={boardData}
        referralPartners={referralPartners.map((p) => ({ id: p.id, name: p.name }))}
        projectTypeOptions={projectTypes.map((t) => t.name)}
        referralPartnersContent={<ReferralPartnersManager initialPartners={referralPartners} />}
      />
    </div>
  );
}
