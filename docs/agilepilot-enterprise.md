# AgilePilot Enterprise — Sell-to-Octopus Strategy

**Status:** Active design  
**Owner:** Capstone Software Solutions  
**Primary GTM:** White-label / OEM sale to Octopus Energy (and Kraken licensees)  
**Fallback GTM:** Multi-supplier load-shifting product for households & SMEs  
**Date:** 2026-07-16

---

## 1. The problem with the £9.99 consumer app alone

A thin “show me cheap Agile half-hours” app is:

| Risk | Why it kills the deal |
|------|------------------------|
| **Easy to copy** | Octopus already has rates, app, Intelligent Octopus, Kraken. Replicating slot UI is weeks of work for them. |
| **Affiliate dependency** | Referral fees (£50–100) are not a defensible business. |
| **Single-supplier lock-in** | If Octopus shuts the API or ships a better free feature, the product dies. |
| **No enterprise procurement path** | Consumer SaaS is not how Octopus buys software. |

**Therefore:** treat consumer AgilePilot as a **demo + data flywheel**, not the exit. The product we sell is **load-shifting intelligence as infrastructure**.

---

## 2. What we actually sell Octopus

### Pitch (one sentence)

> Capstone delivers a multi-tariff, multi-device load-shifting control plane that Octopus can white-label for Kraken tenants worldwide — without Octopus building and maintaining every third-party integration themselves.

### Why Octopus / Kraken would buy (not build)

| Their strength | Our wedge |
|----------------|-----------|
| Billing, CRM, tariffs (Kraken) | They own the meter + account of record |
| Intelligent Octopus EV | Device ecosystem is fragmented; heat pumps, batteries, commercial HVAC lag |
| Global Kraken licensees (EDF, others) | Licensees need **differentiated** smart energy UX without forking core Kraken |
| Grid flexibility / VPP ambitions | Need **third-party** device control + savings attribution that isn’t core billing |

**Build-vs-buy argument we use in the room:**

1. **Not core:** Kraken optimises for billing reliability, not every OEM’s EV charger protocol.  
2. **Speed:** We ship multi-provider adapters + device hooks faster than a platform team prioritising meter-to-cash.  
3. **Risk isolation:** Partner product can fail without taking down billing.  
4. **Multi-supplier proof:** Same control plane already speaks Octopus + EDF (+ others) — useful for Kraken’s multi-retailer customers.  
5. **Procurement packaging:** SOC2-ready path, DPA, NDA, pen-test reports — we show up enterprise-ready.

### What we do *not* claim

- We do not replace Kraken.  
- We do not store or process bank details.  
- We do not claim exclusive access to Octopus rate data (public REST is not a moat).

---

## 3. Moat: protection from “Octopus just builds this”

Public half-hourly rates are **not** protectable. Protect these instead:

### A. Product moat (hardest to copy quickly)

| Asset | Why it resists copy |
|-------|---------------------|
| **Provider-neutral tariff graph** | Normalised slots across Octopus Agile, EDF Freephase/Open Tariffs, future suppliers — not “Octopus only” |
| **Device control adapters** | EVSE, battery, heat pump, smart plug — each is integration debt |
| **Savings attribution model** | Baseline vs shifted kWh with audit trail (enterprise buyers need this) |
| **Orchestration policies** | “Never drop below comfort temp”, “finish EV by 07:00”, multi-objective optimisation |
| **White-label multi-tenant SaaS** | Already multi-tenant in RTE; Octopus becomes a *tenant of tenants* (Kraken licensee) |

### B. Legal / commercial moat

| Instrument | Purpose |
|------------|---------|
| **Mutual NDA** before demos / data rooms | Stops informal knowledge bleed |
| **Pilot MSA + SOW** | Scope locked; IP ownership clauses |
| **Background IP** remains Capstone | Pre-existing code stays ours |
| **Foreground IP** negotiated | Prefer Capstone owns product; Octopus gets **perpetual non-exclusive licence** for Kraken use |
| **Non-solicit / non-circumvent** (limited) | 12–24 months: no hiring key engineers to rebuild the pilot in-house *from our confidential materials* (UK-enforceable carefully; use solicitor) |
| **Source-code escrow** (optional) | Gives them comfort without assignment of IP |
| **Trademark + brand** | Product name separate from “Octopus” |

### C. Process moat

- Confidential demos only after NDA.  
- No open-source of core optimisers until deal strategy is set.  
- Public consumer tier can show *outcomes* (“saved £X”) without shipping policy engine source.

### Honest limit

NDAs and contracts **do not stop** a large energy company from independently building a similar product. They stop misuse of *our confidential information* and create commercial friction. The real defence is **being the multi-supplier + multi-device layer they don’t want to maintain**.

---

## 4. Dual go-to-market

```
                    ┌─────────────────────────────────────┐
                    │     Capstone Load-Shift Platform     │
                    │  (provider adapters + policy engine) │
                    └──────────────┬──────────────────────┘
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
        ┌────────────┐    ┌────────────────┐   ┌──────────────┐
        │  Path A    │    │  Path B        │   │  Path C      │
        │  OEM to    │    │  Consumer/SME  │   │  Other       │
        │  Octopus / │    │  multi-supplier│   │  suppliers / │
        │  Kraken    │    │  (if A stalls) │   │  OEMs        │
        └────────────┘    └────────────────┘   └──────────────┘
```

| Path | Customer | Pricing sketch | When |
|------|----------|----------------|------|
| **A — Primary** | Octopus / Kraken Technologies / licensees | Pilot fee + per-account SaaS or revenue share on flexibility | After NDA + pilot SOW |
| **B — Fallback** | Households & SMEs on any supported tariff | £9.99–£19.99/mo or free + premium | Live now as demo; harden for launch |
| **C — Expansion** | EDF, OVO-adjacent, battery OEMs, heat-pump installers | White-label or API | After 2 providers proven |

**Rule:** Never optimise the codebase for Octopus-only APIs. Always go through the **provider adapter** interface.

---

## 5. Supplier / API landscape (UK)

| Provider | Tariff / product | API posture | Adapter priority |
|----------|------------------|-------------|------------------|
| **Octopus Energy** | Agile, Intelligent, Tracker, Go | Mature public REST (`api.octopus.energy/v1`) + account GraphQL | **P0 — live** |
| **EDF** | Freephase / open residential tariffs | Open tariff APIs (2026); developer portal on **Kraken** (`developer.edfgb-kraken.energy`) | **P1 — next** |
| **Other Kraken retailers** | Varies by licensee | Same platform family as EDF/Octopus | P2 research |
| **OVO** | Charge Anytime / smart plans | Limited public tariff API; often partner/portal | P2 |
| **British Gas / Centrica** | PeakSave etc. | Weak public API; portal-heavy | P3 / manual |
| **National Grid ESO / NESO** | Carbon intensity | Public API — green-shift signals | P1 as *signal*, not supplier |
| **Nord Pool / wholesale** | Day-ahead | Not retail; useful for commercial | P3 |

**Strategic note:** EDF’s open APIs sitting on Kraken is ammunition for Path A — “we already integrate Kraken-family open tariffs; white-label us for all your licensees.”

### Adapter contract (implementation)

```ts
interface TariffProvider {
  id: string;                    // 'octopus' | 'edf' | ...
  displayName: string;
  fetchHalfHourlyRates(input: {
    region?: string;
    productCode?: string;
    from: Date;
    to: Date;
  }): Promise<NormalisedRateSlot[]>;
}
```

Octopus-specific product codes (`AGILE-24-10-01-C`) stay **inside** the Octopus adapter, never in API routes.

---

## 6. Corporate-class security baseline

Target for any Octopus pilot data room:

| Control | Minimum for pilot | Target for production OEM |
|---------|-------------------|---------------------------|
| Transport | TLS 1.2+ only | TLS 1.3 preferred |
| Auth | API keys + tenant isolation | OAuth2/OIDC for enterprise SSO |
| Secrets | Render env / vault; no secrets in git | Rotation + least privilege |
| Data | UK/EU region (Frankfurt already) | Explicit DPA + SCCs if needed |
| Logging | No full account tokens in logs | Structured audit log for admin actions |
| Access | Named Capstone operators only | RBAC + break-glass procedure |
| AppSec | Dependency audit, no raw SQL injection paths | Annual pen-test report |
| Resilience | Health checks, graceful demo fallback | SLO + status page |
| Privacy | Privacy policy; minimal PII | ICO-ready ROPA, retention schedule |

### Data we should *avoid* holding in v1

- Full bank details / Direct Debit  
- Smart meter half-hourly consumption **unless** customer explicitly connects (huge sensitivity)  
- Live control of devices without explicit OAuth to device OEM  

**v1 pilot data:** tariff rates (public), user preferences, optional MPAN region, estimated savings — not full meter telemetry.

### Security workstream (engineering)

1. Provider secrets never client-side  
2. Rate-limit public slots endpoint  
3. Tenant isolation tests for history  
4. Security.txt + vulnerability contact  
5. Document threat model (STRIDE lite) in `docs/agilepilot-threat-model.md` (follow-on)

---

## 7. NDA & commercial sequence

Do **not** cold-demo architecture deep-dives without paper.

| Step | Action | Owner |
|------|--------|-------|
| 1 | Capstone mutual NDA template (UK law) | William + solicitor |
| 2 | One-pager + deck (no confidential IP) | Capstone |
| 3 | Warm intro to Octopus / Kraken innovation / partnerships | Network |
| 4 | NDA signed | Both |
| 5 | Technical deep-dive + security questionnaire | Capstone |
| 6 | Paid pilot SOW (8–12 weeks), IP clauses as above | Both |
| 7 | Decision: OEM licence **or** wind down Path A and push Path B | Capstone |

**Solicitor checklist (budget for this):** mutual NDA, pilot MSA, IP assignment vs licence, confidentiality, data protection schedule, limitation of liability, non-solicit language.

---

## 8. Product architecture (target)

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Octopus REST │   │ EDF Open API │   │ Carbon/NESO  │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └────────────┬─────┴──────────────────┘
                    ▼
         ┌─────────────────────┐
         │  TariffProvider bus │  ← multi-supplier moat
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Policy engine      │  ← “when to shift load”
         │  + savings ledger   │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Surfaces           │
         │  · Consumer API/UI  │
         │  · White-label OEM  │
         │  · Device hooks     │
         └─────────────────────┘
```

**Current code:** thin Octopus fetch + history in `@rte/agilepilot`.  
**Next engineering:** provider interface + Octopus adapter + EDF stub + security headers on routes.

---

## 9. Phased build (while Twilio waits)

### Phase 0 — Strategy & paper (this week)

- [x] Enterprise strategy doc (this file)  
- [x] NDA + pilot IP solicitor brief (`agilepilot-nda-pilot-ip.md`)  
- [x] One-pager pitch (`agilepilot-one-pager.md`)  
- [x] Warm intro templates (`agilepilot-warm-intro.md`)  
- [x] EDF onboarding pack (`agilepilot-edf-onboarding.md`)  
- [x] Threat model (`agilepilot-threat-model.md`)  
- [ ] NDA executed by solicitor + Capstone  
- [ ] EDF developer account registered (human)  
- [ ] First warm intro sent (human)

### Phase 1 — Multi-provider foundation (this sprint)

- [x] `TariffProvider` interface  
- [x] Octopus adapter (extract existing logic)  
- [x] EDF adapter stub + docs links  
- [x] `provider` query param on `GET /api/agilepilot/slots`  
- [x] Enterprise mode suppresses affiliate copy  
- [x] NESO carbon intensity signal  
- [x] Policy engine (EV ready-by, peak avoid, max price, green prefer)

### Phase 2 — Enterprise readiness

- [ ] Audit logging for admin  
- [x] Rate limits on AgilePilot routes  
- [x] Partner API keys (`x-partner-key` / `x-admin-key`)  
- [ ] DPA + privacy policy pages (legal)  
- [x] Threat model doc  
- [x] Savings ledger table + APIs

### Phase 3 — Pilot surface

- [x] White-label brand config + `GET /brand/:slug`  
- [x] Partner dashboard (`GET /partner/me`)  
- [x] Device webhook stubs (log only)

### Phase 4 — Path B consumer harden (parallel)

- [x] Stripe already wired for AgilePilot  
- [x] Landing page: `/agilepilot.html` multi-supplier demo  
- [ ] Full self-serve onboarding (signup → provider pick)

---

## 10. Messaging guide

| Audience | Say | Don’t say |
|----------|-----|-----------|
| Octopus | “White-label load-shift control plane for Kraken tenants” | “We scrape your rates better than your app” |
| Consumers | “Shift loads to the cheapest half-hours on *your* tariff” | “Octopus-only” as the brand |
| Investors | “Multi-supplier flexibility software with OEM path” | “£9.99 SaaS only” |

---

## 11. Success metrics

| Path | Pilot success |
|------|----------------|
| A | Signed NDA + paid pilot OR written pass with learnings |
| B | Paying consumers on ≥2 providers; retention 30-day > 40% |
| Engineering | 100% of rate fetches go through adapters; zero Octopus URLs outside `providers/octopus.ts` |

---

## 12. Immediate next actions

| # | Action | Artefact |
|---|--------|----------|
| 1 | **Legal:** instruct solicitor on mutual NDA + pilot IP | [`agilepilot-nda-pilot-ip.md`](./agilepilot-nda-pilot-ip.md) |
| 2 | **Commercial:** send / print partnership one-pager | [`agilepilot-one-pager.md`](./agilepilot-one-pager.md) |
| 3 | **EDF:** register Capstone on developer portal | [`agilepilot-edf-onboarding.md`](./agilepilot-edf-onboarding.md) |
| 4 | **Outreach:** warm intros + cold templates | [`agilepilot-warm-intro.md`](./agilepilot-warm-intro.md) |
| 5 | **Security:** data room threat model (post-NDA) | [`agilepilot-threat-model.md`](./agilepilot-threat-model.md) |
| 6 | **Engineering:** provider abstraction | Done — `packages/agilepilot/src/providers/` |
| 7 | **Do not** open-source core policy engine until Path A decision | — |

---

## References

- Octopus public API: `https://api.octopus.energy/v1`  
- EDF open tariff APIs: https://www.edfenergy.com/energywise/edfs-open-tariff-apis  
- EDF developer portal: https://developer.edfgb-kraken.energy/  
- Kraken Technologies: https://www.kraken.tech/  
- Existing package: `packages/agilepilot/`
