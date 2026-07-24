import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';

// Shared shapes for API route handlers. Auth lives in `apiAuth.ts`; this is
// everything after it — reading and validating the body, and the handful of
// error responses the routes return over and over.

type Parsed<T> = { data: T; response: null } | { data: null; response: NextResponse };

/**
 * Reads and validates a JSON request body against `schema`.
 *
 * Mirrors the `requireSession` shape so a handler reads the same way:
 *
 *   const { data, response } = await parseBody(req, itemSchema);
 *   if (response) return response;
 *
 * A malformed body is a 400, not an unhandled throw — `await req.json()`
 * rejects on invalid JSON, and no route was catching it.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S
): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { data: null, response: badRequest('Request body must be valid JSON') };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { data: null, response: NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }) };
  }
  return { data: parsed.data, response: null };
}

/** The standard success response for a route with nothing to return (deletes, reorders). */
export function ok() {
  return NextResponse.json({ ok: true });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** 409 — the request was well-formed but conflicts with current state (e.g. deleting a client that still has projects). */
export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

/** The slice of a Prisma model delegate `applyOrder` needs. */
interface ReorderableDelegate {
  update(args: { where: { id: string }; data: { order: number } }): Promise<unknown>;
}

/**
 * Persists a user-dragged ordering: every id in `orderedIds` gets its
 * position as its `order`. Shared by the pipeline-stage, procurement-list,
 * and field-def reorder routes, which are otherwise the same handler.
 */
export async function applyOrder(model: ReorderableDelegate, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, index) => model.update({ where: { id }, data: { order: index } })));
}
