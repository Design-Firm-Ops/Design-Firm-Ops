import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const send = vi.fn(async (_message: Record<string, unknown>) => ({ data: { id: 'msg-1' }, error: null }));
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));

import { sendInvoiceEmail, type InvoiceEmailParams } from '@/lib/email';

const params: InvoiceEmailParams = {
  to: 'client@example.com',
  clientName: 'Westland Reserve',
  companyName: 'Madison Ditton Interiors',
  invoiceNumber: 'MDI-004',
  documentLabel: 'Invoice',
  grandTotal: '$22,933.48',
  dueDate: 'Feb 1, 2026',
  portalUrl: 'https://app.test/portal/invoice/tok',
  primaryColor: '#4A3728',
  accentColor: '#C49A5C',
  pdfBuffer: Buffer.from('%PDF-1.4'),
};

const sent = () => send.mock.calls[0][0];

beforeEach(() => {
  send.mockClear();
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM_EMAIL = 'invoices@designfirmops.app';
});

afterEach(() => {
  delete process.env.RESEND_FROM_EMAIL;
});

describe('sendInvoiceEmail', () => {
  it('addresses the client and names the invoice in the subject', async () => {
    await sendInvoiceEmail(params);
    const message = sent() as unknown as { to: string; subject: string; from: string };

    expect(message.to).toBe('client@example.com');
    expect(message.subject).toContain('MDI-004');
    expect(message.subject).toContain('Madison Ditton Interiors');
    expect(message.from).toBe('Madison Ditton Interiors <invoices@designfirmops.app>');
  });

  it('attaches the PDF under the invoice number', async () => {
    await sendInvoiceEmail(params);
    const { attachments } = sent() as unknown as { attachments: { filename: string; content: Buffer }[] };

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('MDI-004.pdf');
    expect(attachments[0].content).toBe(params.pdfBuffer);
  });

  it('puts the total, due date, and portal link in the body', async () => {
    await sendInvoiceEmail(params);
    const { html } = sent() as unknown as { html: string };

    expect(html).toContain('$22,933.48');
    expect(html).toContain('Feb 1, 2026');
    expect(html).toContain('https://app.test/portal/invoice/tok');
    expect(html).toContain('Westland Reserve');
  });

  it('applies the firm’s branding colours', async () => {
    await sendInvoiceEmail(params);
    const { html } = sent() as unknown as { html: string };
    expect(html).toContain('#4A3728');
    expect(html).toContain('#C49A5C');
  });

  it('uses the document label so a design fee invoice reads correctly', async () => {
    await sendInvoiceEmail({ ...params, documentLabel: 'Design Fee Invoice' });
    const message = sent() as unknown as { subject: string; html: string };
    expect(message.subject).toContain('Design Fee Invoice MDI-004');
    expect(message.html).toContain('design fee invoice');
  });

  it('omits the due date cleanly when there isn’t one', async () => {
    await sendInvoiceEmail({ ...params, dueDate: null });
    const { html } = sent() as unknown as { html: string };
    expect(html).not.toContain('null');
  });

  it('falls back to a default from-address', async () => {
    delete process.env.RESEND_FROM_EMAIL;
    await sendInvoiceEmail(params);
    expect((sent() as unknown as { from: string }).from).toContain('invoices@designfirmops.app');
  });

  it('refuses to send without an API key rather than failing silently', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendInvoiceEmail(params)).rejects.toThrow(/RESEND_API_KEY/);
    expect(send).not.toHaveBeenCalled();
  });
});
