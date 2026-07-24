import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { badRequest, parseBody } from '@/lib/apiRoute';
import { projectSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/lib/projectType';
import { findOrCreateFeeStructureOption } from '@/lib/feeStructure';
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
      projectTypeId,
      designFeeStructureId,
      procurementFeeStructureId,
      startDate: startDate ? new Date(startDate) : null,
      defaultInvoiceColumnConfig: defaultInvoiceColumnConfig === null ? Prisma.JsonNull : defaultInvoiceColumnConfig,
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
