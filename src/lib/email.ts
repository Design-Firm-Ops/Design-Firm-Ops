import { Resend } from 'resend';

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(key);
}

export interface InvoiceEmailParams {
  to: string;
  clientName: string;
  companyName: string;
  invoiceNumber: string;
  grandTotal: string;
  dueDate: string | null;
  portalUrl: string;
  primaryColor: string;
  accentColor: string;
  pdfBuffer: Buffer;
}

function invoiceEmailHtml(params: InvoiceEmailParams): string {
  return `
  <div style="font-family: Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: ${params.primaryColor};">
    <div style="border-bottom: 2px solid ${params.accentColor}; padding-bottom: 16px; margin-bottom: 24px;">
      <h1 style="font-size: 18px; font-weight: 600; margin: 0;">${params.companyName}</h1>
    </div>
    <p>Hi ${params.clientName},</p>
    <p>Invoice ${params.invoiceNumber} is attached — total due is ${params.grandTotal}${
      params.dueDate ? ` by ${params.dueDate}` : ''
    }.</p>
    <p>
      <a href="${params.portalUrl}" style="display: inline-block; background: ${params.primaryColor}; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
        View Invoice
      </a>
    </p>
    <p style="color: #6b5744; font-size: 13px;">Questions about this invoice? Just reply to this email.</p>
  </div>`;
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<void> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'invoices@designfirmops.app';

  await resend.emails.send({
    from: `${params.companyName} <${from}>`,
    to: params.to,
    subject: `Invoice ${params.invoiceNumber} from ${params.companyName}`,
    html: invoiceEmailHtml(params),
    attachments: [
      {
        filename: `${params.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
      },
    ],
  });
}
