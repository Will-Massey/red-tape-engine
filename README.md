# Red Tape Engine

UK automated revenue platform — five verticals, one monorepo, Grok-powered.

## Verticals

| Package | Product | Price | What it does |
|---------|---------|-------|--------------|
| `@rte/tradetap` | TradeTap | £99/mo | Missed call → Grok SMS triage → booking recovery |
| `@rte/complybot` | ComplyBot | £19/mo | Receipt OCR → MTD categorisation → export pack |
| `@rte/planningpulse` | PlanningPulse | £49/mo | Planning.data.gov.uk alerts by geo-fence |
| `@rte/agilepilot` | AgilePilot | £9.99/mo | Octopus Agile cheap-slot recommendations |
| `@rte/housesignal` | HouseSignal | £199/mo | Companies House signal enrichment feed |

## Quick Start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Install
cp .env.example .env
npm install

# 3. Migrate + seed demo data
npm run db:migrate
npm run db:seed

# 4. Run (two terminals)
npm run dev              # API → http://localhost:3847
npm run dev:dashboard    # Dashboard → http://localhost:3848
```

## Demo Mode

Runs without API keys by default (`DEMO_MODE=true`). Grok, Twilio, and Stripe fall back to simulated responses.

## Key Endpoints

- `GET /health` — system status
- `POST /api/tradetap/simulate` — simulate missed call pipeline
- `GET /api/tradetap/report/:tenantId` — weekly PDF-style report
- `POST /api/complybot/receipt` — categorise expense
- `POST /api/planningpulse/poll` — poll planning applications
- `GET /api/agilepilot/slots` — cheap energy windows
- `POST /api/housesignal/scan` — scan Companies House
- `GET /api/dashboard/overview` — all-tenant metrics

## Agent Parallelisation

See `CONTRACTS.md` for interface contracts. Each vertical package is independently ownable by a separate agent/worktree.