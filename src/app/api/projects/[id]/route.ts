import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { jsonOrNull } from '@/server/json';
import { requireSession } from '@/server/apiAuth';
import { notFound, ok, parseBody } from '@/lib/apiRoute';
import { projectSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/server/projectType';
import { findOrCreateFeeStructureOption } from '@/server/feeStructure';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!project) return notFound();
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

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
  if (projectType !== undefined) data.projectTypeId = await findOrCreateProjectType(projectType, firmId);
  if (designFeeStructure !== undefined) {
    data.designFeeStructureId = await findOrCreateFeeStructureOption(designFeeStructure, 'DESIGN_FEE', firmId);
  }
  if (procurementFeeStructure !== undefined) {
    data.procurementFeeStructureId = await findOrCreateFeeStructureOption(procurementFeeStructure, 'PROCUREMENT', firmId);
  }
  if (data.defaultInvoiceColumnConfig === null) data.defaultInvoiceColumnConfig = jsonOrNull(null);

  const project = await db.project.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  await db.project.delete({ where: { id: params.id } });
  return ok();
}
