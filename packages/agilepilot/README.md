# `@rte/agilepilot` — Capstone Load-Shift

Multi-supplier half-hourly tariff intelligence and savings estimates.

**Primary GTM:** white-label / OEM to energy retailers (Octopus, Kraken licensees).  
**Fallback GTM:** multi-supplier consumer product.

## Docs (start here)

| Doc | Purpose |
|-----|---------|
| [../../docs/agilepilot-enterprise.md](../../docs/agilepilot-enterprise.md) | Strategy, moat, dual GTM |
| [../../docs/agilepilot-one-pager.md](../../docs/agilepilot-one-pager.md) | Partnership one-pager (pre-NDA OK) |
| [../../docs/agilepilot-nda-pilot-ip.md](../../docs/agilepilot-nda-pilot-ip.md) | Solicitor brief: NDA + pilot IP |
| [../../docs/agilepilot-warm-intro.md](../../docs/agilepilot-warm-intro.md) | Outreach templates |
| [../../docs/agilepilot-edf-onboarding.md](../../docs/agilepilot-edf-onboarding.md) | EDF developer portal steps |
| [../../docs/agilepilot-threat-model.md](../../docs/agilepilot-threat-model.md) | Security threat model (under NDA) |

## Providers

```
src/providers/
  types.ts      # TariffProvider interface
  octopus.ts    # Live with OCTOPUS_API_KEY
  edf.ts        # Stub until EDF_TARIFF_API_* set
  index.ts      # getProvider / listProviders
```

## API

- `GET /api/agilepilot/providers`
- `GET /api/agilepilot/slots?provider=&tenantId=&policy=true&enterprise=true` — carbon + policy plan + optional ledger write
- `GET /api/agilepilot/history/:tenantId`
- `GET /api/agilepilot/ledger/:tenantId`
- `GET|POST /api/agilepilot/policies/:tenantId`
- `POST /api/agilepilot/devices/:tenantId/webhook`
- `POST /api/agilepilot/partners` — `x-admin-key`
- `GET /api/agilepilot/partner/me` — `x-partner-key`
- `GET /api/agilepilot/brand/:slug`

Landing: `/agilepilot.html`  
Migration: `packages/core/drizzle/0002_agilepilot_platform.sql`

## Tests

```bash
npm run test:agilepilot-policy
```

## Rule

Never put Octopus (or EDF) product URLs outside the matching adapter file.
