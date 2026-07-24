import { describe, it, expect, vi } from 'vitest';
import { nextOrder } from '@/server/order';

/** A stand-in for a Prisma model delegate exposing just `aggregate`. */
function delegate(maxOrder: number | null) {
  return { aggregate: vi.fn(async () => ({ _max: { order: maxOrder } })) };
}

describe('nextOrder', () => {
  it('starts at 0 on an empty table', async () => {
    expect(await nextOrder(delegate(null))).toBe(0);
  });

  it('returns one past the current maximum', async () => {
    expect(await nextOrder(delegate(4))).toBe(5);
  });

  it('handles a zero maximum without falling back to the empty case', async () => {
    expect(await nextOrder(delegate(0))).toBe(1);
  });

  it('scopes the aggregate with the given where clause', async () => {
    const model = delegate(2);
    await nextOrder(model, { projectId: 'p1' });
    expect(model.aggregate).toHaveBeenCalledWith({ _max: { order: true }, where: { projectId: 'p1' } });
  });

  it('omits the where clause entirely when unscoped', async () => {
    const model = delegate(null);
    await nextOrder(model);
    expect(model.aggregate).toHaveBeenCalledWith({ _max: { order: true } });
  });
});
