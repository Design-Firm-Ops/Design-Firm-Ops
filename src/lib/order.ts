/**
 * The "append to the end of a user-ordered list" primitive.
 *
 * Every user-orderable table in the app (offerings, pipeline stages,
 * procurement lists, document folders, field defs, rooms, fee structure
 * options, lead boards) assigns a new row `max(order) + 1`, with an empty
 * table starting at 0. That arithmetic lived inline in eleven places; it
 * lives here now.
 */

/** The slice of a Prisma model delegate this needs — keeps the helper testable without a database. */
interface OrderableDelegate {
  aggregate(args: { _max: { order: true }; where?: Record<string, unknown> }): Promise<{
    _max: { order: number | null };
  }>;
}

/** The next `order` value for `model`, optionally scoped to a subset of rows (e.g. one project's). */
export async function nextOrder(model: OrderableDelegate, where?: Record<string, unknown>): Promise<number> {
  const result = await model.aggregate(where ? { _max: { order: true }, where } : { _max: { order: true } });
  return (result._max.order ?? -1) + 1;
}
