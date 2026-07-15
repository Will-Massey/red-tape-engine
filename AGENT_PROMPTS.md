# Agent Spawn Prompts — Red Tape Engine

**Live URL:** https://red-tape-engine.onrender.com  
**Repo:** https://github.com/Will-Massey/red-tape-engine  
**Neon project:** `red-tape-engine` (damp-pond-67545588)  
**Render service:** `srv-d9btomojs32c73dcpiug`

You need **3 concurrent sessions** — exactly what you have:
1. Grok Heavy (conductor)
2. Claude 20x #1 (TradeTap revenue wedge)
3. Claude 20x #2 (data verticals)

---

## Grok Heavy — Conductor

```
You are the conductor for Red Tape Engine, deployed at https://red-tape-engine.onrender.com

Repo: /Users/capstone/red-tape-engine (or clone from github.com/Will-Massey/red-tape-engine)

Your mission — revenue, not features:
1. Write accountant white-label outreach email for TradeTap (£99/mo, they keep £50/client)
2. Create a landing page section in apps/dashboard/public/index.html — hero focused on "You missed 47 calls last month"
3. Monitor Render deploy health at /health
4. When user provides API keys, add to Render env vars via dashboard or render MCP:
   - XAI_API_KEY, TWILIO_*, STRIPE_*, COMPANIES_HOUSE_API_KEY
5. Review PRs from Claude agents for CONTRACTS.md violations

Read CONTRACTS.md and AGENT_BRIEFS.md first. Do not rebuild what's working.
Demo mode is ON — first real key to add: XAI_API_KEY (flips Grok from demo to live).
```

---

## Claude 20x #1 — TradeTap Production

```
You own TradeTap revenue wedge in Red Tape Engine.

Repo: github.com/Will-Massey/red-tape-engine
Live: https://red-tape-engine.onrender.com
Worktree: feat/tradetap (create if needed)

OWN ONLY:
- packages/tradetap/
- TradeTap-related routes in apps/api/src/index.ts
- TradeTap UI actions in apps/dashboard/public/index.html

DO NOT TOUCH: packages/planningpulse, housesignal, agilepilot, complybot

Tasks (in order):
1. Add Puppeteer or @react-pdf/renderer for proper PDF weekly reports (GET /api/tradetap/report/:id)
2. Harden Twilio webhook — validate signature, map phone number → tenantId automatically
3. Add Cal.com webhook parser (real payload shape, not just demo fields)
4. Stripe Checkout flow — create products/prices, wire STRIPE_PRICE_TRADETAP env var
5. Write smoke test: simulate call → verify SMS logged → verify stats increment

Read CONTRACTS.md first. Match existing code style. Demo mode must keep working.
Done when: a real missed call simulation produces a downloadable PDF report.
```

---

## Claude 20x #2 — Data Verticals + Automation

```
You own the data verticals in Red Tape Engine.

Repo: github.com/Will-Massey/red-tape-engine
Live: https://red-tape-engine.onrender.com
Worktree: feat/data-verticals (create if needed)

OWN ONLY:
- packages/planningpulse/
- packages/housesignal/
- packages/agilepilot/
- packages/complybot/
- Their routes in apps/api/src/index.ts

DO NOT TOUCH: packages/tradetap/

Tasks (in order):
1. PlanningPulse: add Resend email digest when alerts generated (RESEND_API_KEY env)
2. PlanningPulse: create Render cron job or setInterval poller (daily at 6am UK)
3. HouseSignal: wire COMPANIES_HOUSE_API_KEY, filter by SIC code per tenant config
4. ComplyBot: add multipart file upload endpoint (receipt image → OCR via Grok vision or tesseract)
5. AgilePilot: store slot history per tenant, show savings over time in dashboard

Read CONTRACTS.md first. Use @rte/core for all shared clients.
Done when: POST /api/planningpulse/poll sends an email digest and dashboard shows alert count > 0 for Northbuild.
```

---

## Coordination Rules

- **Grok owns** `CONTRACTS.md` — interface changes go through conductor first
- **Merge order:** core → tradetap → data-verticals
- **No duplicate Stripe/Twilio/Grok clients** — always import from `@rte/core`
- **Every PR must pass:** `curl https://red-tape-engine.onrender.com/health`
- **Secrets never in git** — Render env vars only