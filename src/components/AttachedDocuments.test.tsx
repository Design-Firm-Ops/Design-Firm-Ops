import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, userEvent, mockFetch } from '@/test';
import AttachedDocuments from './AttachedDocuments';

const props = {
  listUrl: '/api/items/i1/documents',
  uploadUrl: '/api/documents',
  deleteUrl: (id: string) => `/api/documents/${id}`,
  extraFields: { projectId: 'p1', itemId: 'i1', type: 'VENDOR_INVOICE' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AttachedDocuments', () => {
  it('lists the documents it loads', async () => {
    mockFetch([
      { id: 'd1', filename: 'quote.pdf', url: 'https://example.test/quote.pdf' },
      { id: 'd2', filename: 'spec.pdf', url: null },
    ]);

    render(<AttachedDocuments {...props} />);

    expect(await screen.findByRole('link', { name: 'quote.pdf' })).toHaveAttribute(
      'href',
      'https://example.test/quote.pdf'
    );
    // No signed URL yet — rendered as plain text rather than a dead link.
    expect(screen.getByText('spec.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'spec.pdf' })).not.toBeInTheDocument();
  });

  it('shows the empty message when there is nothing attached', async () => {
    mockFetch([]);
    render(<AttachedDocuments {...props} emptyMessage="Nothing here yet." />);
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
  });

  it('uploads the chosen file with the extra fields', async () => {
    const fetchMock = mockFetch([]);
    render(<AttachedDocuments {...props} />);
    await screen.findByText('No documents attached yet.');

    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('+ Upload'), file);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
      expect(post).toBeDefined();
      expect(post![0]).toBe('/api/documents');
      const body = (post![1] as RequestInit).body as FormData;
      expect(body.get('file')).toBe(file);
      expect(body.get('projectId')).toBe('p1');
      expect(body.get('itemId')).toBe('i1');
      expect(body.get('type')).toBe('VENDOR_INVOICE');
    });
  });

  it('surfaces an upload failure', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        // First call is the initial list; the second is the upload.
        if (call === 1) return { ok: true, status: 200, json: async () => [] } as Response;
        return { ok: false, status: 413, json: async () => ({ error: 'File is too large' }) } as Response;
      })
    );

    render(<AttachedDocuments {...props} />);
    await screen.findByText('No documents attached yet.');

    await userEvent.upload(screen.getByLabelText('+ Upload'), new File(['x'], 'big.pdf'));

    expect(await screen.findByText('File is too large')).toBeInTheDocument();
  });

  it('deletes through the caller-supplied endpoint', async () => {
    const fetchMock = mockFetch([{ id: 'd1', filename: 'quote.pdf', url: null }]);
    render(<AttachedDocuments {...props} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/d1', { method: 'DELETE' })
    );
  });
});
