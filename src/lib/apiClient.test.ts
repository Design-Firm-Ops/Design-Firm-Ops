import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiError, apiSend } from '@/lib/apiClient';

function res(body: unknown, { ok = false, status = 400, json = true } = {}): Response {
  return {
    ok,
    status,
    json: async () => {
      if (!json) throw new SyntaxError('Unexpected token');
      return body;
    },
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiError', () => {
  it('returns a plain string error as-is', async () => {
    expect(await apiError(res({ error: 'This invoice has been voided' }), 'Fallback')).toBe(
      'This invoice has been voided'
    );
  });

  // The whole point: a Zod flatten() used to reach the user as raw JSON.
  it('renders a Zod flatten() payload as readable text', async () => {
    const message = await apiError(
      res({ error: { formErrors: [], fieldErrors: { name: ['Name is required'], email: ['Invalid email'] } } }),
      'Fallback'
    );
    expect(message).toBe('name: Name is required; email: Invalid email');
    expect(message).not.toContain('fieldErrors');
    expect(message).not.toContain('{');
  });

  it('includes form-level errors from a flatten() payload', async () => {
    expect(await apiError(res({ error: { formErrors: ['Pick at least one item'], fieldErrors: {} } }), 'Fallback')).toBe(
      'Pick at least one item'
    );
  });

  it('joins multiple messages for one field', async () => {
    expect(
      await apiError(res({ error: { formErrors: [], fieldErrors: { password: ['Too short', 'Needs a digit'] } } }), 'F')
    ).toBe('password: Too short, Needs a digit');
  });

  it('falls back when the body is not JSON', async () => {
    expect(await apiError(res(null, { json: false }), 'Upload failed.')).toBe('Upload failed.');
  });

  it('falls back when the body has no error field', async () => {
    expect(await apiError(res({}), 'Something went wrong.')).toBe('Something went wrong.');
    expect(await apiError(res({ error: '' }), 'Something went wrong.')).toBe('Something went wrong.');
  });

  it('falls back when the error object is empty', async () => {
    expect(await apiError(res({ error: { formErrors: [], fieldErrors: {} } }), 'Nope.')).toBe('Nope.');
  });
});

describe('apiSend', () => {
  it('posts JSON with the right method, headers, and body', async () => {
    const fetchMock = vi.fn(async () => res({ id: '1' }, { ok: true, status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiSend('/api/vendors', 'POST', { name: 'Acme' });

    expect(fetchMock).toHaveBeenCalledWith('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    });
  });

  it('omits the body and content-type for a bodyless request', async () => {
    const fetchMock = vi.fn(async () => res({ ok: true }, { ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiSend('/api/vendors/1', 'DELETE');

    expect(fetchMock).toHaveBeenCalledWith('/api/vendors/1', { method: 'DELETE' });
  });

  it('returns the raw Response so callers can branch on res.ok', async () => {
    const response = res({ error: 'nope' }, { ok: false, status: 409 });
    vi.stubGlobal('fetch', vi.fn(async () => response));

    const result = await apiSend('/api/x', 'PATCH', {});
    expect(result).toBe(response);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });
});
