import { vi, type Mock } from 'vitest';

// A stub for `@/server/prisma`, so server-side logic can be tested without a
// database.
//
// Deliberately NOT a fake database — it doesn't understand `where`, relations,
// or query semantics, and shouldn't grow to. You say what a call returns; the
// test then asserts on the *decision* the code made. Anything that genuinely
// needs query semantics belongs in an integration test against real Postgres.
//
//   const prisma = mockPrisma();
//   vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));
//
//   prisma.invoice.findUnique.mockResolvedValue(anInvoice);
//   await recalculateInvoiceStatus('inv-1');
//   expect(prisma.invoice.update).toHaveBeenCalledWith(
//     expect.objectContaining({ data: { status: 'PAID' } })
//   );

const OPERATIONS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
] as const;

type Operation = (typeof OPERATIONS)[number];
export type MockDelegate = Record<Operation, Mock>;

/** Sensible empty defaults so an un-stubbed call returns something plausible rather than undefined. */
function createDelegate(): MockDelegate {
  const delegate = {} as MockDelegate;
  for (const operation of OPERATIONS) {
    delegate[operation] = vi.fn(async () => {
      if (operation === 'findMany') return [];
      if (operation === 'count') return 0;
      if (operation === 'aggregate') return { _max: {}, _min: {}, _sum: {}, _avg: {}, _count: 0 };
      if (operation.startsWith('find')) return null;
      return {};
    });
  }
  return delegate;
}

export type PrismaMock = Record<string, MockDelegate> & {
  $transaction: Mock;
  /** Clears call history and stubbed return values on every delegate. */
  reset(): void;
};

/**
 * A Prisma client stub. Model delegates are created lazily, so any model name
 * works without this needing to track the schema.
 */
export function mockPrisma(): PrismaMock {
  const delegates = new Map<string, MockDelegate>();

  const $transaction = vi.fn(async (arg: unknown) => {
    // Both call styles: an array of promises, or a callback given a client.
    if (Array.isArray(arg)) return Promise.all(arg);
    if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(proxy);
    return arg;
  });

  function reset() {
    for (const delegate of delegates.values()) {
      for (const operation of OPERATIONS) delegate[operation].mockReset();
    }
    delegates.clear();
    $transaction.mockClear();
  }

  const proxy = new Proxy({} as PrismaMock, {
    get(_target, property: string) {
      if (property === '$transaction') return $transaction;
      if (property === 'reset') return reset;
      if (typeof property !== 'string' || property.startsWith('$')) return undefined;

      if (!delegates.has(property)) delegates.set(property, createDelegate());
      return delegates.get(property);
    },
  });

  return proxy;
}

/**
 * A single shared instance, for the common case where a test file mocks the
 * module once at the top:
 *
 *   vi.mock('@/server/prisma', () => ({ prisma: prismaMock }));
 *
 * `vi.mock` is hoisted above imports, so the factory can only reference an
 * imported binding — not a `const` declared in the test file. Hence a ready-made
 * instance rather than making every caller build one.
 */
export const prismaMock = mockPrisma();
