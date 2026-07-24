import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { parseBody, ok, notFound, badRequest, conflict, forbidden, applyOrder } from '@/lib/apiRoute';

const schema = z.object({ name: z.string().min(1), qty: z.coerce.number().int().default(1) });

function request(body: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseBody', () => {
  it('returns the parsed data for a valid body', async () => {
    const result = await parseBody(request(JSON.stringify({ name: 'Sconce', qty: '3' })), schema);
    expect(result.response).toBeNull();
    expect(result.data).toEqual({ name: 'Sconce', qty: 3 });
  });

  it('returns a 400 carrying the flattened field errors when validation fails', async () => {
    const result = await parseBody(request(JSON.stringify({ name: '' })), schema);
    expect(result.data).toBeNull();
    expect(result.response?.status).toBe(400);
    const payload = await result.response!.json();
    expect(payload.error.fieldErrors.name).toBeDefined();
  });

  // Previously `await req.json()` threw on a malformed body and the route
  // had no catch, surfacing as an unhandled 500.
  it('returns a 400 rather than throwing on a malformed JSON body', async () => {
    const result = await parseBody(request('{not json'), schema);
    expect(result.data).toBeNull();
    expect(result.response?.status).toBe(400);
    const payload = await result.response!.json();
    expect(payload.error).toBe('Request body must be valid JSON');
  });

  it('returns a 400 on an empty body', async () => {
    const result = await parseBody(request(''), schema);
    expect(result.data).toBeNull();
    expect(result.response?.status).toBe(400);
  });
});

describe('response helpers', () => {
  it('ok() returns { ok: true } with a 200', async () => {
    const res = ok();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('notFound() defaults to "Not found" and accepts a custom message', async () => {
    expect(notFound().status).toBe(404);
    expect(await notFound().json()).toEqual({ error: 'Not found' });
    expect(await notFound('No such vendor').json()).toEqual({ error: 'No such vendor' });
  });

  it('badRequest / conflict / forbidden carry their status and message', async () => {
    expect(badRequest('nope').status).toBe(400);
    expect(conflict('in use').status).toBe(409);
    expect(forbidden('not allowed').status).toBe(403);
    expect(await conflict('in use').json()).toEqual({ error: 'in use' });
  });
});

describe('applyOrder', () => {
  function delegate() {
    return { update: vi.fn(async () => ({})) };
  }

  it('writes each id its index as the new order', async () => {
    const model = delegate();
    await applyOrder(model, ['c', 'a', 'b']);
    expect(model.update).toHaveBeenCalledTimes(3);
    expect(model.update).toHaveBeenNthCalledWith(1, { where: { id: 'c' }, data: { order: 0 } });
    expect(model.update).toHaveBeenNthCalledWith(2, { where: { id: 'a' }, data: { order: 1 } });
    expect(model.update).toHaveBeenNthCalledWith(3, { where: { id: 'b' }, data: { order: 2 } });
  });
});
