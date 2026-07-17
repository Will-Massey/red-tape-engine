import type { FetchRatesInput, NormalisedRateSlot, TariffProvider } from './types.js';
import { demoSlots } from './types.js';

/**
 * EDF open residential tariff APIs (Kraken-hosted developer portal).
 *
 * Portal:       https://developer.edfgb-kraken.energy/
 * GraphQL:      https://developer.edfgb-kraken.energy/graphql/
 * REST:         https://developer.edfgb-kraken.energy/rest/
 * Announcement: https://www.edfenergy.com/energywise/edfs-open-tariff-apis
 * Capstone ops: docs/agilepilot-edf-onboarding.md
 *
 * Live wiring: set EDF_TARIFF_API_KEY or EDF_TARIFF_API_TOKEN after portal registration.
 * Auth scheme (Bearer vs Basic vs GraphQL) is confirmed from their current guides —
 * do not assume Octopus Basic-auth here.
 */
export class EdfProvider implements TariffProvider {
  readonly id = 'edf' as const;
  readonly displayName = 'EDF Energy';

  isLive(): boolean {
    return Boolean(process.env.EDF_TARIFF_API_KEY || process.env.EDF_TARIFF_API_TOKEN);
  }

  private authHeader(): string | null {
    const bearer = process.env.EDF_TARIFF_API_TOKEN;
    if (bearer) return `Bearer ${bearer}`;
    const key = process.env.EDF_TARIFF_API_KEY;
    if (key) return `Bearer ${key}`;
    return null;
  }

  async fetchHalfHourlyRates(input: FetchRatesInput): Promise<NormalisedRateSlot[]> {
    if (!this.isLive()) {
      return demoSlots(input.from).map((s) => ({
        ...s,
        recommendation: `[EDF demo] ${s.recommendation}`,
      }));
    }

    const auth = this.authHeader();
    const base =
      process.env.EDF_TARIFF_API_BASE?.replace(/\/$/, '') ||
      'https://api.edfenergy.com'; // override via env once portal documents the production host

    // Placeholder live path: once schema is known, replace with GraphQL or REST
    // rate query. Keep all EDF URL/product logic inside this file only.
    try {
      const res = await fetch(`${base}/health`, {
        headers: auth ? { Authorization: auth, Accept: 'application/json' } : { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      // Until the real rates endpoint is mapped, do not pretend live data.
      if (!res.ok) {
        console.warn(`[agilepilot:edf] credentials present but probe failed (${res.status}) — serving demo slots`);
        return demoSlots(input.from);
      }

      console.warn(
        '[agilepilot:edf] credentials present; half-hourly mapping not yet implemented — serving demo slots. See docs/agilepilot-edf-onboarding.md',
      );
      return demoSlots(input.from);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[agilepilot:edf] ${msg} — serving demo slots`);
      return demoSlots(input.from);
    }
  }
}
