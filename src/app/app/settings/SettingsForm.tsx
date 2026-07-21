'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import RichTextEditor from '@/components/RichTextEditor';

interface SettingsData {
  id: number;
  companyName: string;
  companyAddress: string | null;
  owner1Name: string | null;
  owner1Contact: string | null;
  owner2Name: string | null;
  owner2Contact: string | null;
  paymentInstructions: string | null;
  logoUrl: string | null;
  invoicePrimaryColor: string | null;
  invoiceAccentColor: string | null;
}

const DEFAULT_PRIMARY_COLOR = '#4A3728';
const DEFAULT_ACCENT_COLOR = '#C49A5C';

export default function SettingsForm({ initialSettings }: { initialSettings: SettingsData | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: initialSettings?.companyName ?? 'Madison Ditton Interiors',
    companyAddress: initialSettings?.companyAddress ?? '',
    owner1Name: initialSettings?.owner1Name ?? '',
    owner1Contact: initialSettings?.owner1Contact ?? '',
    owner2Name: initialSettings?.owner2Name ?? '',
    owner2Contact: initialSettings?.owner2Contact ?? '',
    paymentInstructions: initialSettings?.paymentInstructions ?? '',
    invoicePrimaryColor: initialSettings?.invoicePrimaryColor ?? DEFAULT_PRIMARY_COLOR,
    invoiceAccentColor: initialSettings?.invoiceAccentColor ?? DEFAULT_ACCENT_COLOR,
  });
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, logoUrl: logoUrl ?? '' }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ? JSON.stringify(data.error) : 'Something went wrong.');
      return;
    }

    setMessage('Settings saved.');
    router.refresh();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);

    const res = await fetch('/api/settings/logo', { method: 'POST', body });
    setUploadingLogo(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? 'Logo upload failed.');
      return;
    }

    const data = await res.json();
    setLogoUrl(data.logoUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-medium text-brown">Company</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Company Name</label>
          <input
            className="input"
            required
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Company Address</label>
          <textarea
            className="input"
            rows={2}
            value={form.companyAddress}
            onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brown">Logo</label>
          {logoUrl && (
            <div className="mb-2">
              <Image src={logoUrl} alt="Company logo" width={160} height={80} className="rounded border border-taupe/40 object-contain" unoptimized />
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
          {uploadingLogo && <p className="mt-1 text-sm text-brown/60">Uploading…</p>}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-brown">Invoice Customizer</p>
          <p className="mb-3 text-xs text-brown/50">
            The logo and colors above are used on invoice PDFs and emails. Defaults to the Design Firm Ops brand
            palette.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded border border-taupe/40"
                  value={form.invoicePrimaryColor || DEFAULT_PRIMARY_COLOR}
                  onChange={(e) => setForm({ ...form, invoicePrimaryColor: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={DEFAULT_PRIMARY_COLOR}
                  value={form.invoicePrimaryColor}
                  onChange={(e) => setForm({ ...form, invoicePrimaryColor: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-brown">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 rounded border border-taupe/40"
                  value={form.invoiceAccentColor || DEFAULT_ACCENT_COLOR}
                  onChange={(e) => setForm({ ...form, invoiceAccentColor: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={DEFAULT_ACCENT_COLOR}
                  value={form.invoiceAccentColor}
                  onChange={(e) => setForm({ ...form, invoiceAccentColor: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-taupe">Preview</p>
            <div
              className="rounded-md border border-taupe/40 bg-white p-5"
              style={{ color: form.invoicePrimaryColor || DEFAULT_PRIMARY_COLOR }}
            >
              <div className="mb-4 flex items-start justify-between">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Company logo" className="h-10 max-w-[160px] object-contain" />
                ) : (
                  <span className="text-base font-semibold">{form.companyName || 'Your Company'}</span>
                )}
                <div className="text-right text-xs">
                  <p className="font-semibold">{form.companyName || 'Your Company'}</p>
                  {form.companyAddress && <p className="text-[11px] opacity-70">{form.companyAddress}</p>}
                </div>
              </div>
              <p className="mb-3 text-lg font-medium">Invoice 2506-001</p>
              <div
                className="flex items-center justify-between border-b pb-2 text-xs"
                style={{ borderColor: form.invoiceAccentColor || DEFAULT_ACCENT_COLOR }}
              >
                <span style={{ color: form.invoiceAccentColor || DEFAULT_ACCENT_COLOR }} className="uppercase tracking-[0.1em]">
                  Bill To
                </span>
                <span style={{ color: form.invoiceAccentColor || DEFAULT_ACCENT_COLOR }} className="uppercase tracking-[0.1em]">
                  Issue Date
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-medium text-brown">Owner Contacts</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Owner 1 Name</label>
            <input
              className="input"
              value={form.owner1Name}
              onChange={(e) => setForm({ ...form, owner1Name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Owner 1 Contact</label>
            <input
              className="input"
              placeholder="email / phone"
              value={form.owner1Contact}
              onChange={(e) => setForm({ ...form, owner1Contact: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Owner 2 Name</label>
            <input
              className="input"
              value={form.owner2Name}
              onChange={(e) => setForm({ ...form, owner2Name: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Owner 2 Contact</label>
            <input
              className="input"
              placeholder="email / phone"
              value={form.owner2Contact}
              onChange={(e) => setForm({ ...form, owner2Contact: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-medium text-brown">Payment Instructions</h2>
        <p className="text-sm text-brown/60">
          Rendered on invoice PDFs — ACH routing/account, wire details, Chase Bill Pay, etc.
        </p>
        <RichTextEditor
          value={form.paymentInstructions}
          onChange={(html) => setForm({ ...form, paymentInstructions: html })}
        />
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </form>
  );
}
