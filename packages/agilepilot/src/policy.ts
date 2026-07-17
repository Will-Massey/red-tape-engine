import type { CheapSlot } from '@rte/core';

export type PolicyKind = 'ev_ready_by' | 'peak_avoid' | 'green_prefer' | 'max_price';

export interface LoadShiftPolicy {
  id?: string;
  name: string;
  kind: PolicyKind;
  enabled?: boolean;
  params: Record<string, unknown>;
}

export interface ScoredSlot extends CheapSlot {
  score: number;
  reasons: string[];
  carbonGCo2PerKwh?: number | null;
}

export interface PolicyPlan {
  recommended: ScoredSlot[];
  rejected: ScoredSlot[];
  summary: string;
  policiesApplied: string[];
}

function hourLondon(iso: string): number {
  return Number(
    new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      hour: 'numeric',
      hour12: false,
    }),
  );
}

function num(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Score half-hourly slots against tenant policies.
 * Higher score = better window to shift load into.
 */
export function evaluatePolicies(
  slots: CheapSlot[],
  policies: LoadShiftPolicy[],
  carbonByStart?: Map<string, number>,
): PolicyPlan {
  const active = policies.filter((p) => p.enabled !== false);
  const policiesApplied = active.map((p) => p.name);

  const scored: ScoredSlot[] = slots.map((slot) => {
    const reasons: string[] = [];
    let score = 100 - Math.min(80, Math.max(0, slot.pricePencePerKwh * 2));
    // Prefer cheaper always as base signal
    score += Math.max(0, 20 - slot.pricePencePerKwh);

    const carbon = carbonByStart?.get(slot.start) ?? null;
    if (carbon !== null) {
      // Lower carbon = higher score (UK intensity often 50–300 g/kWh)
      score += Math.max(0, 30 - carbon / 10);
    }

    for (const policy of active) {
      const h = hourLondon(slot.start);

      if (policy.kind === 'ev_ready_by') {
        const deadline = num(policy.params, 'deadlineHour', 7);
        const chargeHours = num(policy.params, 'chargeHours', 4);
        // Prefer windows that finish before deadline, within charge window overnight
        if (h >= 0 && h < deadline) {
          score += 25;
          reasons.push(`${policy.name}: overnight before ${deadline}:00`);
        } else if (h >= 22) {
          score += 15;
          reasons.push(`${policy.name}: late evening charge`);
        } else if (h >= deadline && h < deadline + chargeHours) {
          score -= 40;
          reasons.push(`${policy.name}: after ready-by deadline`);
        }
      }

      if (policy.kind === 'peak_avoid') {
        const peakStart = num(policy.params, 'peakStartHour', 16);
        const peakEnd = num(policy.params, 'peakEndHour', 19);
        if (h >= peakStart && h < peakEnd) {
          score -= 50;
          reasons.push(`${policy.name}: peak window ${peakStart}–${peakEnd}`);
        } else {
          score += 5;
        }
      }

      if (policy.kind === 'max_price') {
        const max = num(policy.params, 'maxPencePerKwh', 15);
        if (slot.pricePencePerKwh > max) {
          score -= 60;
          reasons.push(`${policy.name}: above ${max}p/kWh`);
        } else {
          reasons.push(`${policy.name}: under ${max}p cap`);
        }
      }

      if (policy.kind === 'green_prefer' && carbon !== null) {
        const maxCarbon = num(policy.params, 'maxGCo2PerKwh', 150);
        if (carbon <= maxCarbon) {
          score += 20;
          reasons.push(`${policy.name}: ${Math.round(carbon)}g CO₂/kWh`);
        } else {
          score -= 15;
          reasons.push(`${policy.name}: high carbon ${Math.round(carbon)}g`);
        }
      }
    }

    if (!reasons.length) reasons.push('price-ranked');

    return {
      ...slot,
      score: Math.round(score * 10) / 10,
      reasons,
      carbonGCo2PerKwh: carbon,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const recommended = ranked.filter((s) => s.score >= 40).slice(0, 6);
  const rejected = ranked.filter((s) => s.score < 40).slice(0, 6);

  const top = recommended[0];
  const summary = top
    ? `Best window ${new Date(top.start).toLocaleString('en-GB', { timeZone: 'Europe/London' })} ` +
      `at ${top.pricePencePerKwh}p/kWh (score ${top.score})` +
      (policiesApplied.length ? ` · policies: ${policiesApplied.join(', ')}` : '')
    : 'No slots pass current policies — relax max price or peak avoid';

  return { recommended, rejected, summary, policiesApplied };
}

/** Default policies for EV-heavy households (seed / demo). */
export function defaultEvPolicies(): LoadShiftPolicy[] {
  return [
    {
      name: 'EV ready by 07:00',
      kind: 'ev_ready_by',
      enabled: true,
      params: { deadlineHour: 7, chargeHours: 4 },
    },
    {
      name: 'Avoid evening peak',
      kind: 'peak_avoid',
      enabled: true,
      params: { peakStartHour: 16, peakEndHour: 19 },
    },
    {
      name: 'Cap at 18p/kWh',
      kind: 'max_price',
      enabled: true,
      params: { maxPencePerKwh: 18 },
    },
  ];
}
