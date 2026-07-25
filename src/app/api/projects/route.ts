import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/prisma';
import { currentFirmId } from '@/server/firm';
import { jsonOrNull } from '@/server/json';
import { requireSession } from '@/server/apiAuth';
import { badRequest, parseBody } from '@/lib/apiRoute';
import { projectSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/server/projectType';
import { findOrCreateFeeStructureOption } from '@/server/feeStructure';
import { DEFAULT_PROCUREMENT_LISTS, DEFAULT_DOCUMENT_FOLDERS } from '@/lib/procurement';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const projects = await prisma.project.findMany({
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data, response } = await parseBody(req, projectSchema);
  if (response) return response;

  const {
    startDate,
    projectType,
    designFeeStructure,
    procurementFeeStructure,
    clientId,
    newClientName,
    newClientEmail,
    newClientPhone,
    newClientAddress,
    defaultInvoiceColumnConfig,
    ...rest
  } = data;

  let resolvedClientId = clientId;
  if (!resolvedClientId && newClientName?.trim()) {
    const client = await prisma.client.create({
      data: {
        name: newClientName.trim(),
        firmId: await currentFirmId(),
        email: newClientEmail || null,
        phone: newClientPhone || null,
        billingAddress: newClientAddress || null,
      },
    });
    resolvedClientId = client.id;
  }
  if (!resolvedClientId) {
    return badRequest('A client is required — pick one or fill in the new client fields.');
  }

  const projectTypeId = await findOrCreateProjectType(projectType);
  const designFeeStructureId = await findOrCreateFeeStructureOption(designFeeStructure, 'DESIGN_FEE');
  const procurementFeeStructureId = await findOrCreateFeeStructureOption(procurementFeeStructure, 'PROCUREMENT');

  const project = await prisma.project.create({
    data: {
      ...rest,
      clientId: resolvedClientId,
      firmId: await currentFirmId(),
      projectTypeId,
      designFeeStructureId,
      procurementFeeStructureId,
      startDate: startDate ? new Date(startDate) : null,
      defaultInvoiceColumnConfig: jsonOrNull(defaultInvoiceColumnConfig),
    },
  });

  await prisma.procurementList.createMany({
    data: DEFAULT_PROCUREMENT_LISTS.map((name, order) => ({ projectId: project.id, name, order })),
  });
  await prisma.projectDocumentFolder.createMany({
    data: DEFAULT_DOCUMENT_FOLDERS.map((name, order) => ({ projectId: project.id, name, order })),
  });

  return NextResponse.json(project, { status: 201 });
}
