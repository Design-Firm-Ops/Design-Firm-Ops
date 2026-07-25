import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { requireFirmId } from '@/lib/tenant';
import { getNewProjectFormOptions } from '@/server/queries/projects';
import NewProjectForm from './NewProjectForm';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);
  const firmId = requireFirmId(session);

  const { clients, projectTypes, feeStructureOptions } = await getNewProjectFormOptions(firmId);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium text-brown">New Project</h1>
      <NewProjectForm
        clients={clients}
        projectTypeOptions={projectTypes.map((t) => t.name)}
        designFeeStructureOptions={feeStructureOptions.filter((f) => f.scope === 'DESIGN_FEE').map((f) => f.name)}
        procurementFeeStructureOptions={feeStructureOptions.filter((f) => f.scope === 'PROCUREMENT').map((f) => f.name)}
      />
    </div>
  );
}
