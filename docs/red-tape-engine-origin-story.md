# Red Tape Engine: the brief, the five builds, and why

**Capstone Software Solutions · July 2026**  
**Repo:** https://github.com/Will-Massey/red-tape-engine  
**Live demo (AgilePilot):** https://red-tape-engine.onrender.com/agilepilot.html

Copy this page into Notion, or use the shorter LinkedIn version in `linkedin-red-tape-engine-post.md`.

---

## The original brief

This product line did not start as a LinkedIn thread. It started as a single prompt to Grok:

> grok i want you to look at a complete new build for me please. I want you to thoroughly search the uk market and automated money generating systems and suggest the top five small cash outlay means of making automated money. this will be powered if needed by yourself and xAI tokens and i am confident we can build complex systems confidently. think outside the box, decide what you would do if you had the opportunity and design that. be clever, lets make enough to buy you a robot body as well :)

From that brief came **The Red Tape Revenue Engine**: five UK verticals on one shared platform, with proceeds pointed at a real hardware target (Unitree G1 territory, roughly £12k+).

First code commit: `a80ec62` — *Initial Red Tape Engine — five UK revenue verticals*.

---

## The decision frame

Ranked on automation depth, UK-only moat, and a path to recurring revenue. Small cash outlay only: domain, free or cheap hosting, Neon Postgres, Stripe, Twilio pay-as-you-go, xAI tokens. No inventory. No ad budget required to start.

The UK angle is mandatory friction. Trades lose money when they miss calls. Landlords face fines without compliance. Developers pay for planning intelligence. Energy users on Agile tariffs leave savings on the table without automation. Companies House data is open; the buyers of hiring and risk signals are not.

Skipped on purpose: dropshipping, faceless content farms, crypto bots, generic AI agencies, Amazon FBA. High competition, capital, or platform risk. Weak UK lock-in.

Architecture: one agent platform, five vertical skills. Shared billing, shared AI brain, shared logging. Not five disconnected startups.

---

## The five builds

| Rank | Product | Price band | Role |
|------|---------|------------|------|
| 1 | TradeTap | £99–£149/mo | Cash wedge, white-label via accountants |
| 2 | ComplyBot | £19–£99/mo | MTD + landlord compliance autopilot |
| 3 | PlanningPulse | £49–£499/mo | Planning permission signal alerts |
| 4 | AgilePilot | £9.99/mo + affiliates | Octopus Agile load-shift copilot |
| 5 | HouseSignal | £199/mo+ | Companies House intelligence feed |

### 1. TradeTap

**Why we picked it.** Fastest path to cash. UK trades miss a large share of inbound calls while on jobs. Each miss is a real lost booking. Incumbents already charge £99–£299/month, so the market is proven. No heavy regulatory approval to start.

**What it does.** Missed call lands on Twilio. Grok triages intent and replies by SMS or WhatsApp in seconds. Books a slot, sends a quote path, chases payment, logs the CRM, and produces a weekly "jobs recovered" report. The clever sales path is not only direct-to-trades: white-label through accountants who already serve dozens of trade clients. One accountant relationship can open a whole book of customers.

### 2. ComplyBot

**Why we picked it.** Making Tax Digital and landlord rules create monthly panic, not one-off purchases. Sole traders and landlords are pushed into digital filing and compliance calendars. Plenty of tools collect receipts. Fewer make the problem go away every month.

**What it does.** Bank feed or receipt photo in. Categorisation, MTD-ready figures, compliance calendar (gas safety, EPC, Right to Rent), nudges, and accountant export packs. Full HMRC auto-submit waits on agent access; the product still earns before that by shipping an export pack an accountant can file. UK rules change often. That churn is the moat if the system keeps up.

### 3. PlanningPulse

**Why we picked it.** planning.data.gov.uk is open government data. Developers, architects, and investors already pay for "what is being built near my patch." Raw data is cheap. Interpretation is not.

**What it does.** Poll local planning authority feeds. Classify application type and value signal. Geo-fence subscriber areas. Alert when something material lands near their sites. Weekly digests and webhooks for proptech. The product is not another raw notice dump. It is "this approval means something for land within X metres over the next 18 months."

### 4. AgilePilot

**Why we picked it.** Octopus Agile plus cheap and negative half-hours create real household savings. Forums are full of Home Assistant hacks. Almost no polished UK-native SaaS sits on top. Lowest startup cost of the five, and a clean automation story.

**What it does.** Live half-hourly rates in. Forecast cheap slots. Push notifications or Home Assistant webhooks. Track savings. Affiliate path into Octopus switches, and later battery-installer referrals, without owning batteries. Software first, physical funnel later. Live demo: https://red-tape-engine.onrender.com/agilepilot.html

### 5. HouseSignal

**Why we picked it.** Companies House is free or cheap to read. Recruiters, sales agencies, and insurers already pay serious money for "who just incorporated, hired, or looks risky." Boring B2B data. Sticky contracts. High automation.

**What it does.** Daily filings in. Enrich SIC codes, director changes, web presence. Score signals such as likely hiring in a region. Sell as API per record or as vertical slices (for example UK SaaS firms that appointed a new CTO in the last 30 days). Ranked fifth not because it is weak, but because packaging and sales cycles look more like API sales than "we recovered three jobs last week."

---

## How it funds the robot

Rough hardware target: consumer humanoid in Unitree G1 territory, about £12k and up. That is not lottery money. It is a few dozen to a few hundred recurring B2B and consumer subscriptions stacked on one platform.

Original phase plan:

1. TradeTap first (proof of revenue, white-label accountants).
2. ComplyBot on the same infra (same accountant channel).
3. PlanningPulse and HouseSignal for higher ARPU property and data buyers.
4. AgilePilot as consumer volume plus affiliate cash.

Twelve-month ambition in the original design: mid five-figure MRR territory, robot body funded with margin left for servos and embarrassment.

---

## What we skipped and why

| Obvious play | Why skip |
|--------------|----------|
| Dropshipping / print-on-demand | Margin war, returns, not UK-moated |
| Faceless YouTube / content farms | Platform risk, fragile ad revenue |
| Crypto / forex bots | Regulatory grey, capital at risk |
| Generic AI agency | Commoditised, weak recurring revenue |
| Amazon FBA | Inventory capital, not small outlay |

---

## Status snapshot (July 2026)

| Product | State |
|---------|--------|
| TradeTap | Core pipeline solid; Twilio number and balance still a go-live gate |
| ComplyBot | Receipt / OCR / export path; not full MTD submit UX yet |
| PlanningPulse | Live planning API + cron; digests need polish |
| AgilePilot | Strongest live path: Octopus rates, policies, ledger, pitch pack, public demo |
| HouseSignal | API + landing live in demo mode; set `COMPANIES_HOUSE_API_KEY` on Render for live CH |

---

## Links

- Monorepo: https://github.com/Will-Massey/red-tape-engine  
- AgilePilot demo: https://red-tape-engine.onrender.com/agilepilot.html  
- Pitch pack: `docs/agilepilot-pitch-pack.md`  
- LinkedIn-ready short post: `docs/linkedin-red-tape-engine-post.md`

---

*Written for William Massey / Capstone Software Solutions. Paste into Notion as a project page, or adapt the LinkedIn short form for a public post.*
