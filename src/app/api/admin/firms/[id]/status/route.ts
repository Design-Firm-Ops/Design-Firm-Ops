import { NextRequest, NextResponse } from 'next/server';
import { requireOperator } from '@/server/apiAuth';
import { getPlatformDb } from '@/server/platformDb';
import { recordFirmStatusChange } from '@/server/audit';
import { conflict, notFound, parseBody } from '@/lib/apiRoute';
import { firmStatusSchema } from '@/lib/validation';
import { canTransition } from '@/lib/firmStatus';
import type { FirmStatus } from '@/lib/domain';

// Suspend / reactivate / cancel a firm.
//
// The first /api/admin route, and the first thing in the app that writes
// across the tenant boundary. It goes through `requireOperator` and
// `getPlatformDb` rather than the tenant client — the two are complements, so
// no firm user can reach this even with a valid session.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, unauthorized } = await requireOperator();
  if (unauthorized) return unauthorized;

  const db = getPlatformDb(session);

  const { data, response } = await parseBody(req, firmStatusSchema);
  if (response) return response;

  const firm = await db.firm.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
  if (!firm) return notFound('Firm not found');

  // Re-checked here rather than trusted from the UI: this endpoint is
  // reachable directly, and the transition table is the rule (src/lib/firmStatus.ts).
  const from = firm.status as FirmStatus;
  if (!canTransition(from, data.status)) {
    return conflict(`A ${from.toLowerCase()} firm cannot become ${data.status.toLowerCase()}.`);
  }

  // One transaction, because a status change without its audit record is the
  // gap the acceptance criteria exist to close — and "log it afterwards" is
  // precisely how that gap opens.
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.firm.update({ where: { id: params.id }, data: { status: data.status } });
    await recordFirmStatusChange(tx, session, { firmId: params.id, from, to: data.status });
    return result;
  });

  return NextResponse.json(updated);
}
