import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import Decimal from 'decimal.js';
import { priceLine, computeInvoiceTotals } from '@/lib/pricing';
import { formatMoney, formatPercentFromFraction } from '@/lib/money';
import { INVOICE_COLUMNS, COLUMN_LABELS, InvoiceColumnConfig, InvoiceColumnKey } from '@/lib/invoiceColumns';
import { RichTextPdf } from './richTextToPdf';

// Brand defaults — same values as globals.css --brown / --gold, used
// whenever the firm hasn't set a custom invoice color in Settings.
const DEFAULT_PRIMARY = '#4A3728';
const DEFAULT_ACCENT = '#C49A5C';

export interface InvoicePdfItem {
  id: string;
  tag: string;
  name: string;
  invoiceDisplayName: string | null;
  room: string | null;
  qty: number;
  unitCost: string;
  platformFee: string;
  markupPct: string | null;
  markupMode: 'MARKUP' | 'MARGIN' | null;
  imageUrl: string | null;
}

export interface InvoicePdfProps {
  invoiceNumber: string;
  documentLabel: string;
  status: string;
  issuedDate: string | null;
  dueDate: string | null;
  shippingTotal: string;
  taxRate: string;
  taxBase: 'MERCH_ONLY' | 'MERCH_PLUS_SHIPPING';
  notes: string | null;
  columnConfig: InvoiceColumnConfig;
  items: InvoicePdfItem[];
  project: {
    name: string;
    projectAddress: string | null;
    defaultMarkupPct: string;
    markupMode: 'MARKUP' | 'MARGIN';
  };
  client: { name: string; billingAddress: string | null };
  company: {
    name: string;
    address: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    paymentInstructions: string | null;
    owner1Name: string | null;
    owner1Contact: string | null;
    owner2Name: string | null;
    owner2Contact: string | null;
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function InvoiceDocument(props: InvoicePdfProps) {
  const primary = props.company.primaryColor || DEFAULT_PRIMARY;
  const accent = props.company.accentColor || DEFAULT_ACCENT;
  const columns: InvoiceColumnKey[] = props.columnConfig.columns.filter((c) => (INVOICE_COLUMNS as readonly string[]).includes(c));

  // Price and project only the fields this render is allowed to show —
  // server-side enforcement of columnConfig, not just conditional JSX.
  const priced = props.items.map((item) => {
    const line = priceLine({
      unitCost: item.unitCost,
      platformFee: item.platformFee,
      qty: item.qty,
      markupPct: item.markupPct,
      markupMode: item.markupMode,
      projectDefaultMarkupPct: props.project.defaultMarkupPct,
      projectMarkupMode: props.project.markupMode,
    });
    const row: Record<Exclude<InvoiceColumnKey, 'image'>, string> = {
      tag: item.tag,
      description: item.invoiceDisplayName || item.name,
      qty: String(item.qty),
      unitCost: formatMoney(new Decimal(item.unitCost).plus(item.platformFee)),
      unitPrice: formatMoney(line.unitPrice),
      extended: formatMoney(line.extended),
    };
    return { room: item.room || 'Other', row, extended: line.extended, imageUrl: item.imageUrl };
  });

  const totals = computeInvoiceTotals({
    extendedPrices: priced.map((p) => p.extended),
    shippingTotal: props.shippingTotal,
    taxRate: props.taxRate,
    taxBase: props.taxBase,
  });

  const rooms = Array.from(new Set(priced.map((p) => p.room)));

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: primary },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    logo: { width: 140, height: 56, objectFit: 'contain' },
    companyBlock: { textAlign: 'right' },
    companyName: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    metaBlock: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottom: `1pt solid ${accent}` },
    metaLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2, color: accent },
    metaValue: { fontSize: 10, marginBottom: 6 },
    roomHeading: { backgroundColor: accent, color: '#ffffff', padding: 4, marginTop: 10, fontWeight: 'bold', fontSize: 9, textTransform: 'uppercase' },
    tableHeader: { flexDirection: 'row', borderBottom: `1pt solid ${primary}`, paddingBottom: 4, marginTop: 4 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottom: '0.5pt solid #e0dcd4' },
    cell: { fontSize: 9 },
    thumb: { width: 28, height: 28, objectFit: 'cover', borderRadius: 2 },
    totalsBlock: { marginTop: 20, alignSelf: 'flex-end', width: 220 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
    grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 4, borderTop: `1pt solid ${primary}`, fontWeight: 'bold' },
    footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#8a7a68', textAlign: 'center', borderTop: '0.5pt solid #e0dcd4', paddingTop: 6 },
    pageTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: primary },
  });

  const colWidth = (col: InvoiceColumnKey) => {
    if (col === 'description') return 3;
    if (col === 'image') return 0.6;
    if (col === 'tag') return 1;
    return 1;
  };

  const footer = (
    <View style={styles.footer} fixed>
      <Text>
        {props.company.owner1Name ? `${props.company.owner1Name} · ${props.company.owner1Contact ?? ''}` : ''}
        {props.company.owner1Name && props.company.owner2Name ? '   |   ' : ''}
        {props.company.owner2Name ? `${props.company.owner2Name} · ${props.company.owner2Contact ?? ''}` : ''}
      </Text>
    </View>
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          {props.company.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={props.company.logoUrl} style={styles.logo} />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{props.company.name}</Text>
          )}
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{props.company.name}</Text>
            {props.company.address && <Text style={{ fontSize: 9 }}>{props.company.address}</Text>}
          </View>
        </View>

        <Text style={styles.pageTitle}>
          {props.documentLabel} {props.invoiceNumber}
        </Text>

        <View style={styles.metaBlock}>
          <View>
            <Text style={styles.metaLabel}>Bill To</Text>
            <Text style={styles.metaValue}>{props.client.name}</Text>
            {props.client.billingAddress && <Text style={styles.metaValue}>{props.client.billingAddress}</Text>}
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{props.project.name}</Text>
            {props.project.projectAddress && <Text style={styles.metaValue}>{props.project.projectAddress}</Text>}
          </View>
          <View>
            <Text style={styles.metaLabel}>Issue Date</Text>
            <Text style={styles.metaValue}>{fmtDate(props.issuedDate)}</Text>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{fmtDate(props.dueDate)}</Text>
          </View>
        </View>

        {rooms.map((room) => (
          <View key={room}>
            <Text style={styles.roomHeading}>{room}</Text>
            <View style={styles.tableHeader}>
              {columns.map((col) => (
                <Text key={col} style={[styles.cell, { flex: colWidth(col), fontWeight: 'bold' }]}>
                  {COLUMN_LABELS[col]}
                </Text>
              ))}
            </View>
            {priced
              .filter((p) => p.room === room)
              .map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  {columns.map((col) =>
                    col === 'image' ? (
                      <View key={col} style={{ flex: colWidth(col) }}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        {p.imageUrl && <Image src={p.imageUrl} style={styles.thumb} />}
                      </View>
                    ) : (
                      <Text key={col} style={[styles.cell, { flex: colWidth(col) }]}>
                        {p.row[col]}
                      </Text>
                    )
                  )}
                </View>
              ))}
          </View>
        ))}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Merchandise</Text>
            <Text>{formatMoney(totals.merchandiseSubtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Shipping</Text>
            <Text>{formatMoney(totals.shippingTotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Tax ({formatPercentFromFraction(totals.taxRate)})</Text>
            <Text>{formatMoney(totals.tax)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text>Grand Total</Text>
            <Text>{formatMoney(totals.grandTotal)}</Text>
          </View>
        </View>

        {props.notes && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.metaLabel}>Notes</Text>
            <Text style={{ fontSize: 9 }}>{props.notes}</Text>
          </View>
        )}

        {footer}
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.pageTitle}>Payment Instructions</Text>
        <RichTextPdf html={props.company.paymentInstructions} style={{ fontSize: 10 }} />
        {footer}
      </Page>
    </Document>
  );
}
