/**
 * Normalised half-hourly (or similar) rate slot.
 * Provider-specific fields stay in the adapter — never leak product codes
 * or supplier quirks into the public API surface.
 */
export interface NormalisedRateSlot {
  start: string;
  end: string;
  /** Inclusive of VAT where the supplier publishes it that way. */
  pricePencePerKwh: number;
  recommendation: string;
  /** Optional carbon / signal metadata for green-shift policies. */
  carbonIntensity?: number | null;
}

export interface FetchRatesInput {
  region?: string;
  productCode?: string;
  from: Date;
  to: Date;
}

export type TariffProviderId = 'octopus' | 'edf' | 'demo';

/**
 * Multi-supplier moat: every retail integration implements this.
 * Octopus must never be special-cased outside its adapter.
 */
export interface TariffProvider {
  readonly id: TariffProviderId;
  readonly displayName: string;
  /** True when live credentials are present and the remote API is preferred. */
  isLive(): boolean;
  fetchHalfHourlyRates(input: FetchRatesInput): Promise<NormalisedRateSlot[]>;
}

export function recommendAction(pricePence: number): string {
  if (pricePence < 0) return 'Charge everything — negative pricing!';
  if (pricePence < 5) return 'Ideal EV/battery charge window';
  if (pricePence < 12) return 'Run dishwasher, washing machine, dryer';
  if (pricePence < 20) return 'Acceptable for background loads';
  return 'Avoid high-draw appliances';
}

/** Deterministic demo series for sales decks and offline CI. */
export function demoSlots(from = new Date()): NormalisedRateSlot[] {
  const prices = [-2.1, 3.4, 5.8, 8.2, 14.5, 22.1];
  return prices.map((p, i) => {
    const start = new Date(from.getTime() + i * 2 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      pricePencePerKwh: p,
      recommendation: recommendAction(p),
    };
  });
}
