import React from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { getRecentBookings, getTradeTapStats, getTriageBreakdown, type TradeTapStats } from './stats.js';
import { getTenant } from './tenants.js';

/**
 * PDF is rendered with @react-pdf/renderer rather than Puppeteer: Render's free
 * plan is 512MB and a headless Chromium adds a ~170MB build download plus
 * ~300MB per render, which OOMs the instance.
 */

const INK = '#0f172a';
const MUTED = '#64748b';
const ACCENT = '#0d9488';
const LINE = '#e2e8f0';

const styles = StyleSheet.create({
  page: { paddingHorizontal: 42, paddingVertical: 40, fontSize: 10, color: INK },
  brand: { fontSize: 8, letterSpacing: 1.5, color: ACCENT },
  title: { fontSize: 20, marginTop: 6 },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 3 },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 16 },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 5,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  tileLabel: { fontSize: 7, letterSpacing: 0.6, color: MUTED },
  tileValue: { fontSize: 17, marginTop: 5 },
  tileValueAccent: { fontSize: 17, marginTop: 5, color: ACCENT },
  section: { fontSize: 11, marginBottom: 8 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 5 },
  tr: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  thText: { fontSize: 7, letterSpacing: 0.6, color: MUTED },
  empty: { fontSize: 9, color: MUTED, fontStyle: 'italic', paddingVertical: 8 },
  colWide: { flex: 2 },
  col: { flex: 1 },
  colRight: { flex: 1, textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 26,
    left: 42,
    right: 42,
    fontSize: 7,
    color: MUTED,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
  },
});

export interface WeeklyReportData {
  businessName: string;
  generatedAt: Date;
  stats: TradeTapStats;
  bookings: Array<{
    phone: string;
    source: string;
    estimatedValuePence: number;
    createdAt: Date;
  }>;
  triage: Array<{ classification: string | null; total: number }>;
}

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const shortDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={accent ? styles.tileValueAccent : styles.tileValue}>{value}</Text>
    </View>
  );
}

export function WeeklyReportDocument({ data }: { data: WeeklyReportData }) {
  const periodEnd = data.generatedAt;
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  return (
    <Document
      title={`TradeTap Weekly Report — ${data.businessName}`}
      author="Red Tape Engine"
      subject="Missed call recovery"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>TRADETAP</Text>
        <Text style={styles.title}>Weekly recovery report</Text>
        <Text style={styles.subtitle}>
          {data.businessName} · {shortDate(periodStart)} – {shortDate(periodEnd)}
        </Text>

        <View style={styles.rule} />

        <View style={styles.tileRow}>
          <Tile label="Missed calls" value={String(data.stats.missedCalls)} />
          <Tile label="Jobs recovered" value={String(data.stats.recoveredJobs)} />
          <Tile label="Recovery rate" value={`${data.stats.recoveryRate}%`} />
          <Tile label="Revenue attributed" value={`£${data.stats.attributedRevenueGbp}`} accent />
        </View>

        <View style={styles.rule} />

        <Text style={styles.section}>Recent bookings</Text>
        {data.bookings.length === 0 ? (
          <Text style={styles.empty}>No bookings recorded in this period.</Text>
        ) : (
          <View>
            <View style={styles.th}>
              <Text style={[styles.thText, styles.colWide]}>CONTACT</Text>
              <Text style={[styles.thText, styles.col]}>SOURCE</Text>
              <Text style={[styles.thText, styles.col]}>DATE</Text>
              <Text style={[styles.thText, styles.colRight]}>VALUE</Text>
            </View>
            {data.bookings.map((booking, i) => (
              <View key={i} style={styles.tr}>
                <Text style={styles.colWide}>{booking.phone}</Text>
                <Text style={styles.col}>{booking.source.replace(/_/g, ' ')}</Text>
                <Text style={styles.col}>{shortDate(booking.createdAt)}</Text>
                <Text style={styles.colRight}>{gbp(booking.estimatedValuePence)}</Text>
              </View>
            ))}
          </View>
        )}

        {data.triage.length > 0 && (
          <View>
            <View style={styles.rule} />
            <Text style={styles.section}>Call triage</Text>
            <View style={styles.th}>
              <Text style={[styles.thText, styles.colWide]}>CLASSIFICATION</Text>
              <Text style={[styles.thText, styles.colRight]}>CALLS</Text>
            </View>
            {data.triage.map((row, i) => (
              <View key={i} style={styles.tr}>
                <Text style={styles.colWide}>{row.classification ?? 'unclassified'}</Text>
                <Text style={styles.colRight}>{row.total}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Powered by Red Tape Engine / TradeTap</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function getWeeklyReportData(tenantId: string): Promise<WeeklyReportData> {
  const [tenant, stats, bookings, triage] = await Promise.all([
    getTenant(tenantId),
    getTradeTapStats(tenantId),
    getRecentBookings(tenantId),
    getTriageBreakdown(tenantId),
  ]);

  return {
    businessName: tenant?.name ?? tenantId,
    generatedAt: new Date(),
    stats,
    bookings: bookings.map((b) => ({
      phone: b.phone,
      source: b.source,
      estimatedValuePence: b.estimatedValuePence,
      createdAt: b.createdAt,
    })),
    triage,
  };
}

export async function generateWeeklyReportPdf(tenantId: string): Promise<Buffer> {
  const data = await getWeeklyReportData(tenantId);
  return renderToBuffer(<WeeklyReportDocument data={data} />);
}

/** Plain-text variant kept for the existing text/plain route and email digests. */
export async function generateWeeklyReport(tenantId: string): Promise<string> {
  const data = await getWeeklyReportData(tenantId);

  return [
    `TRADETAP WEEKLY REPORT — ${data.businessName}`,
    `Period: Last 7 days`,
    ``,
    `Missed calls:     ${data.stats.missedCalls}`,
    `Jobs recovered:   ${data.stats.recoveredJobs}`,
    `Recovery rate:    ${data.stats.recoveryRate}%`,
    `Revenue attributed: £${data.stats.attributedRevenueGbp}`,
    ``,
    `Recent bookings:`,
    ...data.bookings.map(
      (b) => `  • ${b.phone} — ${gbp(b.estimatedValuePence)} (${b.source})`,
    ),
    ``,
    `Powered by Red Tape Engine / TradeTap`,
  ].join('\n');
}

export function weeklyReportFilename(businessName: string, generatedAt = new Date()): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `tradetap-weekly-${slug || 'report'}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}
