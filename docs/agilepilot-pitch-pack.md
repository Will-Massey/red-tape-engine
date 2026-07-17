# AgilePilot pitch pack (live)

**Updated:** 2026-07-17  
**Prod (free Render):** https://red-tape-engine.onrender.com  
**Landing demo:** https://red-tape-engine.onrender.com/agilepilot.html  
**Ops dashboard:** https://red-tape-engine.onrender.com/  
**Deploy:** free plan, Frankfurt · Neon Postgres · auto-deploy on `main`

---

## 60-second live demo

1. Open https://red-tape-engine.onrender.com/agilepilot.html  
   - Free tier may cold-start 30–60s on first hit.
2. Confirm metrics: cheapest p/kWh, est. save, CO₂, `live=yes` for Octopus.
3. Click **Ledger (demo tenant)** — shows 30-day savings attribution.
4. Click **OEM brand** — white-label `capstone-demo` / FlexShift.
5. Optional: **Start AgilePilot trial** — Stripe test Checkout (£9.99/mo).

### Demo tenant

| Field | Value |
|-------|--------|
| Name | Agile Home UK |
| Tenant ID | `0e99308d-9a09-4620-b420-4951eacaf971` |
| Partner slug | `capstone-demo` |
| Product name | FlexShift |

### Curl one-liners

```bash
curl -sS https://red-tape-engine.onrender.com/health | python3 -m json.tool

curl -sS 'https://red-tape-engine.onrender.com/api/agilepilot/slots?provider=octopus&enterprise=true&policy=true' \
  | python3 -m json.tool

curl -sS https://red-tape-engine.onrender.com/api/agilepilot/brand/capstone-demo | python3 -m json.tool

# Full smoke
AGILEPILOT_ADMIN_KEY=… node scripts/smoke-prod-agilepilot.mjs
```

---

## Docs to attach pre-NDA

| Doc | Use |
|-----|-----|
| [agilepilot-one-pager.md](./agilepilot-one-pager.md) | Forward freely |
| [agilepilot-warm-intro.md](./agilepilot-warm-intro.md) | LinkedIn / intro scripts |
| [agilepilot-enterprise.md](./agilepilot-enterprise.md) | Strategy depth |

## Docs only after NDA

| Doc | Use |
|-----|-----|
| [agilepilot-threat-model.md](./agilepilot-threat-model.md) | Security questionnaire |
| [agilepilot-nda-pilot-ip.md](./agilepilot-nda-pilot-ip.md) | Solicitor + commercial positions |
| Source / architecture deep-dive | Not public |

---

## Reach (draft — not launched)

| Item | Value |
|------|--------|
| Brand profile | **AgilePilot / Capstone Load-Shift** (`30bb4e3b-…`) |
| Campaign | **AgilePilot — energy retailer / Kraken intro (draft)** (`d84e0f78-…`) |
| Status | **draft** — 3 steps, A/B on touch 1 — **do not launch until leads + mailbox attached** |
| App | https://reach.capstonesoftware.co.uk |

## Outlook drafts (ready to edit & send)

Three drafts saved to **william@fortisaccounts.com** Drafts folder:

1. Instruct solicitor — mutual NDA + pilot MSA  
2. Warm intro request (Octopus/Kraken)  
3. Cold email template for named partnerships contacts  

## What still needs a human

| Item | Why blocked |
|------|-------------|
| Instruct solicitor | Needs firm selection + payment — draft is in Outlook |
| Send warm intros | Needs real mutual connections / LinkedIn — draft is in Outlook |
| Attach energy leads + launch Reach campaign | Campaign is draft only; wrong ICP leads would burn domain |
| EDF live rates | Portal registration + API keys |
| Twilio / TradeTap voice | Regulatory number approval + balance £0 |
| Leave Stripe test mode | Live keys + business decision |

---

## Stripe (test)

- AgilePilot price: £9.99/mo (`STRIPE_PRICE_AGILE` on Render)
- Checkout: `POST /api/checkout` with `{ "vertical": "agilepilot", "tenantId": "…", "email": "…" }`
- Creates trial tenant automatically if `tenantId` omitted

## Twilio (blocked)

- Numbers on account: **0**
- Balance: **£0.00 GBP**
- Do not activate voice campaigns until number + balance

## EDF

- Portal: https://developer.edfgb-kraken.energy/
- Set `EDF_TARIFF_API_KEY` or `EDF_TARIFF_API_TOKEN` on Render when issued
- Adapter: `packages/agilepilot/src/providers/edf.ts`
