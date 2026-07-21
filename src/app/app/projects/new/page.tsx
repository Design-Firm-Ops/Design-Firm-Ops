import { prisma } from '@/lib/prisma';
import NewProjectForm from './NewProjectForm';

export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const [clients, projectTypes, feeStructureOptions] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.projectType.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
    prisma.feeStructureOption.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
  ]);

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
