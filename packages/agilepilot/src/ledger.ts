import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@rte/core';
import type { CheapSlot } from '@rte/core';
import { baselinePence, savingsPenceFor, shiftableKwh } from './history.js';

export interface LedgerWriteInput {
  tenantId: string;
  partnerId?: string | null;
  provider: string;
  region?: string;
  slot: CheapSlot;
  carbonGCo2PerKwh?: number | null;
  policyId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordSavings(input: LedgerWriteInput) {
  const baseline = baselinePence();
  const kwh = shiftableKwh();
  const savings = savingsPenceFor(input.slot.pricePencePerKwh, baseline, kwh);

  const [row] = await db
    .insert(schema.savingsLedger)
    .values({
      tenantId: input.tenantId,
      partnerId: input.partnerId ?? null,
      provider: input.provider,
      region: input.region ?? null,
      windowStart: new Date(input.slot.start),
      windowEnd: new Date(input.slot.end),
      pricePencePerKwh: input.slot.pricePencePerKwh,
      baselinePence: baseline,
      kwh,
      savingsPence: savings,
      carbonGCo2PerKwh: input.carbonGCo2PerKwh ?? null,
      policyId: input.policyId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  return row;
}

export async function getLedgerSummary(
  tenantId: string,
  options: { days?: number } = {},
) {
  const days = options.days && options.days > 0 ? options.days : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(schema.savingsLedger)
    .where(
      and(
        eq(schema.savingsLedger.tenantId, tenantId),
        gte(schema.savingsLedger.createdAt, since),
      ),
    )
    .orderBy(desc(schema.savingsLedger.createdAt))
    .limit(200);

  const totalSavingsPence = rows.reduce((s, r) => s + r.savingsPence, 0);
  const totalKwh = rows.reduce((s, r) => s + r.kwh, 0);

  return {
    days,
    entries: rows.length,
    totalSavingsPence: Math.round(totalSavingsPence * 100) / 100,
    totalSavingsGbp: (totalSavingsPence / 100).toFixed(2),
    totalKwh: Math.round(totalKwh * 100) / 100,
    recent: rows.slice(0, 20).map((r) => ({
      id: r.id,
      provider: r.provider,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
      pricePencePerKwh: r.pricePencePerKwh,
      savingsPence: r.savingsPence,
      carbonGCo2PerKwh: r.carbonGCo2PerKwh,
      createdAt: r.createdAt,
    })),
  };
}

export async function getPartnerLedgerAggregate(partnerId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [agg] = await db
    .select({
      entries: sql<number>`count(*)::int`,
      totalSavingsPence: sql<number>`coalesce(sum(${schema.savingsLedger.savingsPence}), 0)`,
      tenants: sql<number>`count(distinct ${schema.savingsLedger.tenantId})::int`,
    })
    .from(schema.savingsLedger)
    .where(
      and(
        eq(schema.savingsLedger.partnerId, partnerId),
        gte(schema.savingsLedger.createdAt, since),
      ),
    );

  return {
    days,
    entries: agg?.entries ?? 0,
    tenants: agg?.tenants ?? 0,
    totalSavingsPence: Number(agg?.totalSavingsPence ?? 0),
    totalSavingsGbp: (Number(agg?.totalSavingsPence ?? 0) / 100).toFixed(2),
  };
}
