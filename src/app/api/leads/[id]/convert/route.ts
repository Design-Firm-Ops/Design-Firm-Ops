import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { requireSession } from '@/server/apiAuth';
import { conflict, notFound } from '@/lib/apiRoute';
import { DEFAULT_PROCUREMENT_LISTS } from '@/lib/procurement';

/**
 * Converts a lead into a real Client + Project. The lead record stays
 * in the CRM (linked via convertedProjectId) rather than being
 * deleted, so the pipeline history is preserved.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return notFound();
  if (lead.convertedProjectId) {
    return conflict('This lead has already been converted');
  }

  const client = await prisma.client.create({
    data: {
      name: lead.clientName,
      email: lead.contactEmail,
      phone: lead.contactPhone,
      billingAddress: lead.address,
      notes: lead.notes,
    },
  });

  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: `${lead.clientName} Project`,
      projectAddress: lead.address,
      projectTypeId: lead.projectTypeId,
      status: 'ACTIVE',
    },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { convertedProjectId: project.id } });

  await prisma.procurementList.createMany({
    data: DEFAULT_PROCUREMENT_LISTS.map((name, order) => ({ projectId: project.id, name, order })),
  });

  // Move any documents saved on the lead card into the new project's
  // Project Documents tab rather than copying files.
  await prisma.document.updateMany({
    where: { leadId: lead.id },
    data: { leadId: null, projectId: project.id, folder: 'Outside Design Documents' },
  });

  return NextResponse.json({ client, project }, { status: 201 });
}
