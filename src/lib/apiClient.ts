// The browser side of talking to our own API. Every client component was
// hand-writing the same fetch options and the same "pull an error message
// off the response" dance; both live here now.

type Method = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Sends JSON to an API route. Returns the raw `Response` so callers keep
 * branching on `res.ok` the way they already do:
 *
 *   const res = await apiSend(`/api/vendors/${id}`, 'PATCH', form);
 *   if (!res.ok) return setError(await apiError(res, 'Could not save vendor.'));
 */
export function apiSend(url: string, method: Method, body?: unknown): Promise<Response> {
  if (body === undefined) return fetch(url, { method });
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A Zod `flatten()` payload, which is what a 400 from `parseBody` carries. */
interface FlattenedError {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

function isFlattened(value: unknown): value is FlattenedError {
  return typeof value === 'object' && value !== null && ('formErrors' in value || 'fieldErrors' in value);
}

/**
 * The message to show the user for a failed response.
 *
 * A validation failure arrives as Zod's `flatten()` shape. Call sites used to
 * `JSON.stringify` it, which put `{"formErrors":[],"fieldErrors":{…}}` on
 * screen; this turns it into "name: Name is required; email: Invalid email".
 * Anything unrecognizable falls back to the caller's message.
 */
export async function apiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const error = (body as { error?: unknown } | null)?.error;

  if (typeof error === 'string' && error.trim()) return error;

  if (isFlattened(error)) {
    const parts = [
      ...(error.formErrors ?? []),
      ...Object.entries(error.fieldErrors ?? {})
        .filter(([, messages]) => messages?.length)
        .map(([field, messages]) => `${field}: ${messages!.join(', ')}`),
    ];
    if (parts.length) return parts.join('; ');
  }

  return fallback;
}
