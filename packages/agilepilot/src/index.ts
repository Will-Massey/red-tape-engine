import { logUsage } from '@rte/core';
import type { CheapSlot } from '@rte/core';

const OCTOPUS_API = 'https://api.octopus.energy/v1/products';

async function fetchAgileRates(region = 'C'): Promise<CheapSlot[]> {
  const apiKey = process.env.OCTOPUS_API_KEY;

  if (!apiKey) {
    return demoSlots();
  }

  try {
    const productCode = `AGILE-24-10-01-${region}`;
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const url = `${OCTOPUS_API}/${productCode}/standard-unit-rates/?period_from=${from}&period_to=${to}`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}` },
    });

    if (!res.ok) throw new Error(`Octopus API ${res.status}`);

    const data = (await res.json()) as {
      results: Array<{ value_inc_vat: number; valid_from: string; valid_to: string }>;
    };

    const sorted = [...data.results].sort((a, b) => a.value_inc_vat - b.value_inc_vat);
    return sorted.slice(0, 6).map((r) => ({
      start: r.valid_from,
      end: r.valid_to,
      pricePencePerKwh: Math.round(r.value_inc_vat * 100) / 100,
      recommendation: recommendAction(r.value_inc_vat),
    }));
  } catch {
    return demoSlots();
  }
}

function recommendAction(pricePence: number): string {
  if (pricePence < 0) return 'Charge everything — negative pricing!';
  if (pricePence < 5) return 'Ideal EV/battery charge window';
  if (pricePence < 12) return 'Run dishwasher, washing machine, dryer';
  if (pricePence < 20) return 'Acceptable for background loads';
  return 'Avoid high-draw appliances';
}

function demoSlots(): CheapSlot[] {
  const now = Date.now();
  const prices = [-2.1, 3.4, 5.8, 8.2, 14.5, 22.1];
  return prices.map((p, i) => {
    const start = new Date(now + i * 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      pricePencePerKwh: p,
      recommendation: recommendAction(p),
    };
  });
}

export async function getCheapSlots(input?: { tenantId?: string; region?: string }) {
  const slots = await fetchAgileRates(input?.region ?? 'C');

  if (input?.tenantId) {
    await logUsage({
      tenantId: input.tenantId,
      vertical: 'agilepilot',
      action: 'slots_fetched',
      metadata: { count: slots.length, cheapest: slots[0]?.pricePencePerKwh },
    });
  }

  const cheapest = slots[0];
  const savingsEstimate = cheapest && cheapest.pricePencePerKwh < 10
    ? `Est. £${((15 - cheapest.pricePencePerKwh) * 0.5).toFixed(2)} saved per 0.5kWh cycle`
    : 'No exceptional savings window right now';

  return {
    slots,
    cheapest,
    savingsEstimate,
    affiliateNote: 'Switch to Octopus Agile — affiliate £50-100 per referral',
  };
}