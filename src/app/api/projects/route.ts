import { NextRequest, NextResponse } from 'next/server';
import { tenantContext } from '@/server/tenantDb';
import { jsonOrNull } from '@/server/json';
import { requireSession } from '@/server/apiAuth';
import { badRequest, parseBody } from '@/lib/apiRoute';
import { projectSchema } from '@/lib/validation';
import { findOrCreateProjectType } from '@/server/projectType';
import { findOrCreateFeeStructureOption } from '@/server/feeStructure';
import { DEFAULT_PROCUREMENT_LISTS, DEFAULT_DOCUMENT_FOLDERS } from '@/lib/procurement';

export async function GET() {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

  const projects = await db.project.findMany({
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { db, firmId } = tenantContext(session);

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
    const client = await db.client.create({
      data: {
        name: newClientName.trim(),
        firmId: firmId,
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

  const projectTypeId = await findOrCreateProjectType(projectType, firmId);
  const designFeeStructureId = await findOrCreateFeeStructureOption(designFeeStructure, 'DESIGN_FEE', firmId);
  const procurementFeeStructureId = await findOrCreateFeeStructureOption(procurementFeeStructure, 'PROCUREMENT', firmId);

  const project = await db.project.create({
    data: {
      ...rest,
      clientId: resolvedClientId,
      firmId: firmId,
      projectTypeId,
      designFeeStructureId,
      procurementFeeStructureId,
      startDate: startDate ? new Date(startDate) : null,
      defaultInvoiceColumnConfig: jsonOrNull(defaultInvoiceColumnConfig),
    },
  });

  await db.procurementList.createMany({
    data: DEFAULT_PROCUREMENT_LISTS.map((name, order) => ({ projectId: project.id, name, order, firmId })),
  });
  await db.projectDocumentFolder.createMany({
    data: DEFAULT_DOCUMENT_FOLDERS.map((name, order) => ({ projectId: project.id, name, order, firmId })),
  });

  return NextResponse.json(project, { status: 201 });
}
