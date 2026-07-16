import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';

/**
 * Converts a lead into a real Client + Project. The lead record stays
 * in the CRM (linked via convertedProjectId) rather than being
 * deleted, so the pipeline history is preserved.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (lead.convertedProjectId) {
    return NextResponse.json({ error: 'This lead has already been converted' }, { status: 409 });
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
      status: 'LEAD',
    },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { convertedProjectId: project.id } });

  return NextResponse.json({ client, project }, { status: 201 });
}
