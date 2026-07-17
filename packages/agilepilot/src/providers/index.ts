import { EdfProvider } from './edf.js';
import { OctopusProvider } from './octopus.js';
import type { TariffProvider, TariffProviderId } from './types.js';
import { demoSlots } from './types.js';

export type { FetchRatesInput, NormalisedRateSlot, TariffProvider, TariffProviderId } from './types.js';
export { demoSlots, recommendAction } from './types.js';
export { OctopusProvider } from './octopus.js';
export { EdfProvider } from './edf.js';

const providers: Record<TariffProviderId, TariffProvider> = {
  octopus: new OctopusProvider(),
  edf: new EdfProvider(),
  demo: {
    id: 'demo',
    displayName: 'Demo (offline)',
    isLive: () => false,
    fetchHalfHourlyRates: async (input) => demoSlots(input.from),
  },
};

export function getProvider(id?: string | null): TariffProvider {
  const key = (id || process.env.AGILEPILOT_DEFAULT_PROVIDER || 'octopus') as TariffProviderId;
  return providers[key] ?? providers.octopus;
}

export function listProviders(): Array<{
  id: TariffProviderId;
  displayName: string;
  live: boolean;
}> {
  return (Object.keys(providers) as TariffProviderId[]).map((id) => ({
    id,
    displayName: providers[id].displayName,
    live: providers[id].isLive(),
  }));
}
