import type { FetchRatesInput, NormalisedRateSlot, TariffProvider } from './types.js';
import { demoSlots, recommendAction } from './types.js';

const OCTOPUS_API = 'https://api.octopus.energy/v1/products';

/**
 * Octopus Energy public REST adapter.
 * Half-hourly Agile unit rates are public (no key required).
 * Optional OCTOPUS_API_KEY is reserved for account-scoped endpoints later.
 */
export class OctopusProvider implements TariffProvider {
  readonly id = 'octopus' as const;
  readonly displayName = 'Octopus Energy';

  isLive(): boolean {
    // Public standard-unit-rates do not require a key.
    return process.env.AGILEPILOT_FORCE_DEMO !== 'true';
  }

  async fetchHalfHourlyRates(input: FetchRatesInput): Promise<NormalisedRateSlot[]> {
    if (process.env.AGILEPILOT_FORCE_DEMO === 'true') {
      return demoSlots(input.from);
    }

    const region = (input.region ?? 'C').replace(/^_/, '').toUpperCase();
    // Product codes are national (e.g. AGILE-24-10-01); region lives on the tariff.
    const productCode = input.productCode ?? 'AGILE-24-10-01';
    const tariffCode = productCode.includes('E-1R-')
      ? productCode
      : `E-1R-${productCode}-${region}`;
    const productPath = productCode.startsWith('E-1R-')
      ? productCode.replace(/^E-1R-/, '').replace(/-[A-Z]$/, '')
      : productCode;

    const from = input.from.toISOString();
    const to = input.to.toISOString();
    const url =
      `${OCTOPUS_API}/${productPath}/electricity-tariffs/${tariffCode}` +
      `/standard-unit-rates/?period_from=${from}&period_to=${to}&page_size=96`;

    try {
      const headers: Record<string, string> = {};
      const apiKey = process.env.OCTOPUS_API_KEY;
      if (apiKey) {
        headers.Authorization = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Octopus API ${res.status}`);

      const data = (await res.json()) as {
        results: Array<{ value_inc_vat: number; valid_from: string; valid_to: string }>;
      };

      if (!data.results?.length) throw new Error('Octopus empty rates');

      // value_inc_vat is already pence/kWh on the public API.
      const sorted = [...data.results].sort((a, b) => a.value_inc_vat - b.value_inc_vat);
      return sorted.slice(0, 12).map((r) => ({
        start: r.valid_from,
        end: r.valid_to,
        pricePencePerKwh: Math.round(r.value_inc_vat * 100) / 100,
        recommendation: recommendAction(r.value_inc_vat),
      }));
    } catch {
      return demoSlots(input.from);
    }
  }
}
