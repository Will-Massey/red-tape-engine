import { logUsage } from '@rte/core';
import type { CheapSlot } from '@rte/core';
import {
  SLOTS_FETCHED,
  averagePence,
  baselinePence,
  getSlotHistory,
  savingsPenceFor,
  shiftableKwh,
} from './history.js';
import { getProvider, listProviders } from './providers/index.js';
import type { TariffProviderId } from './providers/index.js';
import { carbonMapForSlots } from './carbon.js';
import { evaluatePolicies, type LoadShiftPolicy } from './policy.js';
import { listPolicies, upsertDefaultPolicies } from './policies-db.js';
import { recordSavings } from './ledger.js';

export { getProvider, listProviders } from './providers/index.js';
export type { TariffProvider, TariffProviderId, NormalisedRateSlot } from './providers/index.js';
export { evaluatePolicies, defaultEvPolicies } from './policy.js';
export type { LoadShiftPolicy, PolicyKind, PolicyPlan, ScoredSlot } from './policy.js';
export { getSlotHistory } from './history.js';
export type { SlotHistory, SlotHistoryEntry } from './history.js';
export { getLedgerSummary, getPartnerLedgerAggregate, recordSavings } from './ledger.js';
export {
  createPartner,
  getPartnerByApiKey,
  getPartnerBySlug,
  listPartners,
  partnerDashboard,
  publicBrand,
} from './partners.js';
export { receiveDeviceWebhook, listDeviceEvents } from './devices.js';
export type { DeviceType } from './devices.js';
export {
  listPolicies,
  upsertDefaultPolicies,
  createPolicy,
  setPolicyEnabled,
} from './policies-db.js';
export { rateLimit } from './rate-limit.js';
export { fetchCarbonIntensity24h, carbonMapForSlots } from './carbon.js';

async function fetchRates(options: {
  providerId?: string;
  region?: string;
  productCode?: string;
}): Promise<{ slots: CheapSlot[]; providerId: string; providerName: string; live: boolean }> {
  const provider = getProvider(options.providerId);
  const now = new Date();
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const slots = await provider.fetchHalfHourlyRates({
    region: options.region ?? 'C',
    productCode: options.productCode,
    from: now,
    to,
  });

  return {
    slots,
    providerId: provider.id,
    providerName: provider.displayName,
    live: provider.isLive(),
  };
}

export async function getCheapSlots(input?: {
  tenantId?: string;
  partnerId?: string | null;
  region?: string;
  provider?: string;
  productCode?: string;
  includeHistory?: boolean;
  enterpriseMode?: boolean;
  /** Attach NESO carbon intensity + score slots */
  withCarbon?: boolean;
  /** Evaluate load-shift policies (loads DB policies when tenantId set) */
  withPolicy?: boolean;
  policies?: LoadShiftPolicy[];
  /** Write cheapest window to savings ledger */
  recordLedger?: boolean;
}) {
  const region = input?.region ?? 'C';
  const { slots, providerId, providerName, live } = await fetchRates({
    providerId: input?.provider,
    region,
    productCode: input?.productCode,
  });

  const ordered = [...slots].sort((a, b) => a.pricePencePerKwh - b.pricePencePerKwh);
  const cheapest = ordered[0];
  const avg = averagePence(ordered);
  const savingsPence = cheapest ? savingsPenceFor(cheapest.pricePencePerKwh) : 0;

  let carbonMap: Map<string, number> | undefined;
  if (input?.withCarbon !== false) {
    carbonMap = await carbonMapForSlots(ordered.map((s) => s.start));
  }

  let policies: LoadShiftPolicy[] = input?.policies ?? [];
  if (input?.withPolicy && input.tenantId && !policies.length) {
    policies = await listPolicies(input.tenantId);
    if (!policies.length) policies = await upsertDefaultPolicies(input.tenantId);
  } else if (input?.withPolicy && !policies.length) {
    const { defaultEvPolicies } = await import('./policy.js');
    policies = defaultEvPolicies();
  }

  const plan =
    input?.withPolicy || policies.length
      ? evaluatePolicies(ordered, policies, carbonMap)
      : undefined;

  if (input?.tenantId) {
    await logUsage({
      tenantId: input.tenantId,
      vertical: 'agilepilot',
      action: SLOTS_FETCHED,
      metadata: {
        count: ordered.length,
        cheapest: cheapest?.pricePencePerKwh,
        avg,
        region,
        provider: providerId,
        live,
        savingsPence,
        baselinePence: baselinePence(),
        shiftableKwh: shiftableKwh(),
        partnerId: input.partnerId ?? null,
      },
    });

    if (input.recordLedger !== false && cheapest) {
      const top = plan?.recommended[0] ?? cheapest;
      await recordSavings({
        tenantId: input.tenantId,
        partnerId: input.partnerId,
        provider: providerId,
        region,
        slot: top,
        carbonGCo2PerKwh: carbonMap?.get(top.start) ?? null,
        policyId: plan?.policiesApplied[0] ?? null,
        metadata: { source: 'slots_fetch', score: plan?.recommended[0]?.score },
      });
    }
  }

  const savingsEstimate =
    cheapest && savingsPence > 0
      ? `Est. £${(savingsPence / 100).toFixed(2)} saved shifting ${shiftableKwh()}kWh ` +
        `vs a ${baselinePence()}p/kWh flat rate`
      : 'No exceptional savings window right now';

  const history =
    input?.tenantId && input.includeHistory ? await getSlotHistory(input.tenantId) : undefined;

  const enterprise =
    input?.enterpriseMode === true || process.env.AGILEPILOT_ENTERPRISE_MODE === 'true';

  const slotsWithCarbon = ordered.map((s) => ({
    ...s,
    carbonGCo2PerKwh: carbonMap?.get(s.start) ?? null,
  }));

  return {
    slots: slotsWithCarbon,
    cheapest: cheapest
      ? { ...cheapest, carbonGCo2PerKwh: carbonMap?.get(cheapest.start) ?? null }
      : undefined,
    avg,
    savingsPence,
    savingsEstimate,
    provider: { id: providerId as TariffProviderId, name: providerName, live },
    plan,
    ...(history ? { history } : {}),
    ...(enterprise
      ? {}
      : {
          affiliateNote:
            providerId === 'octopus'
              ? 'Switch to Octopus Agile — affiliate £50-100 per referral (Path B consumer)'
              : undefined,
        }),
  };
}
