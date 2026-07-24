import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/apiAuth';
import { notFound, ok, parseBody } from '@/lib/apiRoute';
import { projectSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/lib/projectType';
import { findOrCreateFeeStructureOption } from '@/lib/feeStructure';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!project) return notFound();
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { data: payload, response } = await parseBody(req, projectSchema.partial());
  if (response) return response;

  const {
    startDate,
    projectType,
    designFeeStructure,
    procurementFeeStructure,
    newClientName,
    newClientEmail,
    newClientPhone,
    newClientAddress,
    clientId,
    ...rest
  } = payload;

  const data: Record<string, unknown> = { ...rest };
  if (clientId) data.clientId = clientId;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (projectType !== undefined) data.projectTypeId = await findOrCreateProjectType(projectType);
  if (designFeeStructure !== undefined) {
    data.designFeeStructureId = await findOrCreateFeeStructureOption(designFeeStructure, 'DESIGN_FEE');
  }
  if (procurementFeeStructure !== undefined) {
    data.procurementFeeStructureId = await findOrCreateFeeStructureOption(procurementFeeStructure, 'PROCUREMENT');
  }
  if (data.defaultInvoiceColumnConfig === null) data.defaultInvoiceColumnConfig = Prisma.JsonNull;

  const project = await prisma.project.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  await prisma.project.delete({ where: { id: params.id } });
  return ok();
}
