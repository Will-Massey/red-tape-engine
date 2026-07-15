import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@rte/core';
import type { CheapSlot } from '@rte/core';

/**
 * Slot history is derived from usage_events, which already records every
 * slots_fetched call. That keeps history working without a new table —
 * packages/core owns the schema.
 */
export const SLOTS_FETCHED = 'slots_fetched';

/** Rough flat-rate comparison, so "saved vs standard tariff" means something. */
export const DEFAULT_BASELINE_PENCE = 24.5;

/** Shiftable daily load: an EV top-up or a dishwasher/washer cycle. */
export const DEFAULT_SHIFTABLE_KWH = 3.5;

export function baselinePence(): number {
  const raw = Number(process.env.AGILEPILOT_BASELINE_PENCE);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BASELINE_PENCE;
}

export function shiftableKwh(): number {
  const raw = Number(process.env.AGILEPILOT_SHIFTABLE_KWH);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SHIFTABLE_KWH;
}

/** Never negative: a cheap slot above the flat rate saves nothing, it costs. */
export function savingsPenceFor(cheapestPence: number, baseline = baselinePence(), kwh = shiftableKwh()): number {
  return Math.max(0, Math.round((baseline - cheapestPence) * kwh * 100) / 100);
}

export function averagePence(slots: CheapSlot[]): number | null {
  if (!slots.length) return null;
  const total = slots.reduce((sum, s) => sum + s.pricePencePerKwh, 0);
  return Math.round((total / slots.length) * 100) / 100;
}

export interface SlotHistoryEntry {
  date: string;
  cheapestPencePerKwh: number;
  avgPencePerKwh: number | null;
  savingsPence: number;
  samples: number;
}

export interface SlotHistory {
  entries: SlotHistoryEntry[];
  days: number;
  totalSavingsPence: number;
  totalSavingsGbp: string;
  bestDay: SlotHistoryEntry | null;
  baselinePence: number;
  shiftableKwh: number;
}

function londonDate(at: Date): string {
  // en-CA renders as YYYY-MM-DD, which sorts lexicographically.
  return at.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function getSlotHistory(
  tenantId: string,
  options: { days?: number } = {},
): Promise<SlotHistory> {
  const rows = await db
    .select()
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tenantId, tenantId),
        eq(schema.usageEvents.vertical, 'agilepilot'),
        eq(schema.usageEvents.action, SLOTS_FETCHED),
      ),
    )
    .orderBy(desc(schema.usageEvents.createdAt));

  // The dashboard fetches slots on every render, so collapse to one entry per
  // day (the best price seen) rather than one per call.
  const byDay = new Map<string, { cheapest: number; avgs: number[]; samples: number }>();

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const cheapest = numberOrNull(meta.cheapest);
    if (cheapest === null) continue;

    const date = londonDate(row.createdAt);
    const day = byDay.get(date);
    const avg = numberOrNull(meta.avg);

    if (!day) {
      byDay.set(date, { cheapest, avgs: avg === null ? [] : [avg], samples: 1 });
      continue;
    }

    day.cheapest = Math.min(day.cheapest, cheapest);
    day.samples += 1;
    if (avg !== null) day.avgs.push(avg);
  }

  const baseline = baselinePence();
  const kwh = shiftableKwh();

  let entries: SlotHistoryEntry[] = [...byDay.entries()]
    .map(([date, day]) => ({
      date,
      cheapestPencePerKwh: Math.round(day.cheapest * 100) / 100,
      avgPencePerKwh: day.avgs.length
        ? Math.round((day.avgs.reduce((a, b) => a + b, 0) / day.avgs.length) * 100) / 100
        : null,
      savingsPence: savingsPenceFor(day.cheapest, baseline, kwh),
      samples: day.samples,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (options.days && options.days > 0) entries = entries.slice(0, options.days);

  const totalSavingsPence = Math.round(entries.reduce((sum, e) => sum + e.savingsPence, 0) * 100) / 100;

  const bestDay = entries.reduce<SlotHistoryEntry | null>(
    (best, e) => (best === null || e.savingsPence > best.savingsPence ? e : best),
    null,
  );

  return {
    entries,
    days: entries.length,
    totalSavingsPence,
    totalSavingsGbp: (totalSavingsPence / 100).toFixed(2),
    bestDay,
    baselinePence: baseline,
    shiftableKwh: kwh,
  };
}
