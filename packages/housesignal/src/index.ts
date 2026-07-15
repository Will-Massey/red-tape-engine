import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema, enrichCompanySignal, logUsage } from '@rte/core';
import type { CompanySignal } from '@rte/core';

const CH_API = 'https://api.company-information.service.gov.uk';

export type SignalSource = 'live' | 'demo';

interface FetchResult {
  signals: CompanySignal[];
  source: SignalSource;
  error?: string;
}

/**
 * Companies House authenticates with the API key as the Basic-auth username
 * and an empty password.
 */
function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

function advancedSearchUrl(sicCodes: string[], days: number, size: number): string {
  const params = new URLSearchParams({
    incorporated_from: daysAgo(days),
    size: String(size),
  });

  // Filter at the API rather than post-filtering a fixed-size page, which would
  // silently drop matches that fell outside the first N results.
  for (const code of sicCodes) params.append('sic_codes', code);

  return `${CH_API}/advanced-search/companies?${params.toString()}`;
}

async function fetchRecentFilings(sicFilter: string[] = []): Promise<FetchResult> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

  if (!apiKey) {
    return { signals: demoSignals(sicFilter), source: 'demo' };
  }

  try {
    const res = await fetch(advancedSearchUrl(sicFilter, 7, 50), {
      headers: { Authorization: authHeader(apiKey), Accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`Companies House ${res.status} ${res.statusText}`);

    const data = (await res.json()) as {
      items?: Array<{
        company_number: string;
        company_name: string;
        date_of_creation: string;
        sic_codes?: string[];
      }>;
    };

    const items = data.items ?? [];

    // Belt and braces: keep the client-side check so a change in the API's
    // filter semantics cannot leak non-matching companies through.
    const matched = sicFilter.length
      ? items.filter((c) => c.sic_codes?.some((s) => sicFilter.includes(s)))
      : items;

    return {
      signals: matched.map((c) => ({
        companyNumber: c.company_number,
        companyName: c.company_name,
        signalType: 'incorporation' as const,
        signalDate: c.date_of_creation,
        enrichment: '',
        score: 0,
      })),
      source: 'live',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn(`HouseSignal: Companies House lookup failed (${error}) — using demo signals`);
    return { signals: demoSignals(sicFilter), source: 'demo', error };
  }
}

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const DEMO_SIC: Record<string, string[]> = {
  '14829103': ['62012'],
  '13284756': ['62020'],
  '09123456': ['43210'],
};

function demoSignals(sicFilter: string[] = []): CompanySignal[] {
  const all: CompanySignal[] = [
    {
      companyNumber: '14829103',
      companyName: 'CloudStack Analytics Ltd',
      signalType: 'incorporation',
      signalDate: daysAgo(2),
      enrichment: '',
      score: 0,
    },
    {
      companyNumber: '13284756',
      companyName: 'Meridian SaaS Group Ltd',
      signalType: 'new_director',
      signalDate: daysAgo(1),
      enrichment: '',
      score: 0,
    },
    {
      companyNumber: '09123456',
      companyName: 'Northern Digital Works Ltd',
      signalType: 'accounts_filed',
      signalDate: daysAgo(3),
      enrichment: '',
      score: 0,
    },
  ];

  if (!sicFilter.length) return all;
  return all.filter((s) => DEMO_SIC[s.companyNumber]?.some((code) => sicFilter.includes(code)));
}

function sicCodesOf(config: unknown): string[] {
  if (!config || typeof config !== 'object') return [];
  const codes = (config as Record<string, unknown>).sicCodes;
  if (!Array.isArray(codes)) return [];
  return codes.filter((c): c is string => typeof c === 'string');
}

/**
 * Explicit codes win; otherwise fall back to the tenant's configured SIC codes
 * so a scan for a tenant filters to their sector.
 */
async function resolveSicCodes(input?: {
  tenantId?: string;
  sicCodes?: string[];
}): Promise<string[]> {
  if (input?.sicCodes?.length) return input.sicCodes;
  if (!input?.tenantId) return [];

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);

  return tenant ? sicCodesOf(tenant.config) : [];
}

/**
 * Signals already stored, so a repeat scan does not duplicate rows or pay to
 * re-enrich the same company through Grok.
 */
async function alreadyStored(signals: CompanySignal[]): Promise<Set<string>> {
  if (!signals.length) return new Set();

  const rows = await db
    .select({
      companyNumber: schema.companySignals.companyNumber,
      signalType: schema.companySignals.signalType,
      signalDate: schema.companySignals.signalDate,
    })
    .from(schema.companySignals)
    .where(
      inArray(
        schema.companySignals.companyNumber,
        signals.map((s) => s.companyNumber),
      ),
    );

  return new Set(rows.map((r) => `${r.companyNumber}:${r.signalType}:${r.signalDate}`));
}

export async function scanCompanies(input?: { tenantId?: string; sicCodes?: string[] }) {
  const sicCodes = await resolveSicCodes(input);
  const { signals: raw, source, error } = await fetchRecentFilings(sicCodes);

  const seen = await alreadyStored(raw);
  const enriched = [];
  let skipped = 0;

  for (const signal of raw) {
    const key = `${signal.companyNumber}:${signal.signalType}:${signal.signalDate}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    const { enrichment, score } = await enrichCompanySignal({
      companyName: signal.companyName,
      signalType: signal.signalType,
      sicCodes,
    });

    const [row] = await db
      .insert(schema.companySignals)
      .values({
        companyNumber: signal.companyNumber,
        companyName: signal.companyName,
        signalType: signal.signalType,
        signalDate: signal.signalDate,
        enrichment,
        score,
      })
      .returning();

    enriched.push(row);

    if (input?.tenantId) {
      await logUsage({
        tenantId: input.tenantId,
        vertical: 'housesignal',
        action: 'signal_scanned',
        metadata: { companyNumber: signal.companyNumber, score, source },
      });
    }
  }

  return {
    scanned: raw.length,
    newSignals: enriched.length,
    skipped,
    sicCodes,
    source,
    ...(error ? { error } : {}),
    signals: enriched,
  };
}

export async function getSignals(limit = 50) {
  return db
    .select()
    .from(schema.companySignals)
    .orderBy(desc(schema.companySignals.createdAt))
    .limit(limit);
}
