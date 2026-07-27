// Rules for administering teammates.
//
// Shared by the settings UI and the API route so they cannot disagree about
// what's allowed — the UI hides what the server would refuse, and the server
// refuses it regardless of what the UI showed.

export const SELF_DEACTIVATION_MESSAGE = 'You cannot deactivate your own account.';

/**
 * Whether an update would deactivate the person making it.
 *
 * Always refused. Deactivation blocks sign-in (see `authorize`), so doing it to
 * yourself is an immediate self-lockout with no way back except asking another
 * administrator — a mistake with no undo available to the person who made it.
 *
 * Distinct from the "at least one active administrator" rule, which protects
 * the *firm*: that one still permits locking yourself out while a colleague
 * remains an admin. This protects the person.
 */
export function isSelfDeactivation(
  actorId: string | null | undefined,
  targetId: string,
  update: { active?: boolean }
): boolean {
  if (update.active !== false) return false;

  // No actor means we can't prove it *isn't* self-deactivation. Refusing is the
  // safe direction: a caller with no identity has no business deactivating
  // anyone, and the route's auth guard has already run by this point.
  return !actorId || actorId === targetId;
}
