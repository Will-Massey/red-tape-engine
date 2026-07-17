# EDF Open Tariff API — Onboarding Pack

**Goal:** Live `EdfProvider` adapter (P1 multi-supplier moat)  
**Portal:** https://developer.edfgb-kraken.energy/  
**Public announcement:** https://www.edfenergy.com/energywise/edfs-open-tariff-apis  
**Status:** Adapter stubbed in code; awaiting Capstone developer credentials  

---

## 1. Why EDF matters strategically

| Point | Detail |
|-------|--------|
| Open tariffs (2026) | EDF published residential open tariff APIs for developers |
| **Kraken-hosted** | Developer portal is `*.edfgb-kraken.energy` — same platform family as Octopus/Kraken |
| Path A pitch | “We already integrate Kraken-family open tariffs for licensees” |
| Path B product | Consumer can pick EDF Freephase-class tariffs, not Octopus-only |

---

## 2. Registration steps (William — do this)

1. Open https://developer.edfgb-kraken.energy/  
2. Create a developer account with **Capstone company email** (not personal Gmail if avoidable).  
3. Read:  
   - GraphQL guides: https://developer.edfgb-kraken.energy/graphql/guides/  
   - REST guides: https://developer.edfgb-kraken.energy/rest/guides/  
   - Announcements: https://developer.edfgb-kraken.energy/announcements/  
4. Request API access / create application credentials as the portal requires (OAuth client, API key, or GraphQL token — follow their current auth guide).  
5. Subscribe to API announcements so breaking changes don’t surprise production.  
6. Store credentials **only** in:
   - Local: `red-tape-engine/.env` (gitignored)  
   - Production: Render env for `red-tape-engine` service  
7. **Never** paste keys into chat, Notion public pages, or git.

### Credentials checklist

| Secret | Env var (Capstone convention) | Where set |
|--------|-------------------------------|-----------|
| EDF API key or token | `EDF_TARIFF_API_KEY` or `EDF_TARIFF_API_TOKEN` | Render + local `.env` |
| Optional base URL override | `EDF_TARIFF_API_BASE` | Only if non-default |
| Default provider | `AGILEPILOT_DEFAULT_PROVIDER=octopus` | Keep octopus until EDF live |

After keys exist, message Capstone engineering (or this agent): *“EDF keys on Render”* — then live adapter work starts.

---

## 3. Engineering status

| Item | Status |
|------|--------|
| `TariffProvider` interface | Done |
| `OctopusProvider` | Done (live with `OCTOPUS_API_KEY`) |
| `EdfProvider` stub | Done — returns demo slots until `isLive()` |
| Live GraphQL/REST mapping | **Blocked on credentials + reading their schema** |
| `GET /api/agilepilot/providers` | Lists `edf` with `live: false` until keys |

Code: `packages/agilepilot/src/providers/edf.ts`

### Implementation plan once keys arrive (estimate 0.5–1 day)

1. Auth: confirm header scheme (Bearer vs Basic vs GraphQL session).  
2. Query: list products / half-hourly unit rates for Freephase or open residential tariffs.  
3. Map to `NormalisedRateSlot` (`start`, `end`, `pricePencePerKwh`, `recommendation`).  
4. Error handling: fall back to demo only in non-production; fail closed or cache last-good in production.  
5. Tests: fixture JSON from a recorded response (no secrets in fixtures).  
6. Docs: update `CONTRACTS.md` with EDF-specific query params if any.

---

## 4. Manual smoke tests (after live)

```bash
# Providers should show edf live: true
curl -s "$API/api/agilepilot/providers" | python3 -m json.tool

# EDF slots
curl -s "$API/api/agilepilot/slots?provider=edf&enterprise=true" | python3 -m json.tool

# Compare to Octopus
curl -s "$API/api/agilepilot/slots?provider=octopus&enterprise=true" | python3 -m json.tool
```

---

## 5. Compliance notes

- EDF open tariffs are for building tools that help households — respect their terms of use and rate limits.  
- Do not scrape consumer account data without OAuth/customer consent.  
- Pilot with Octopus: mention multi-provider capability; do not claim EDF partnership without EDF agreement.

---

## 6. Related

- Strategy: `docs/agilepilot-enterprise.md`  
- One-pager: `docs/agilepilot-one-pager.md`  
