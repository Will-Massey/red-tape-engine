# Agent Spawn Briefs

Three concurrent agents. **Use git worktrees** — never share one working tree across agents (`apps/api/src/index.ts` is last-writer-wins). Do not cross file boundaries without merging to main first.

## Grok Heavy — Conductor
- Owns: `CONTRACTS.md`, integration review, `.env` setup, sales copy
- Branch: `main`
- After boot: configure real API keys, test end-to-end, write accountant outreach email

## Claude 20x #1 — TradeTap
- Owns: `packages/tradetap/`, TradeTap dashboard actions
- Worktree: `feat/tradetap`
- Next: Twilio number provisioning, Cal.com webhook hardening, PDF report via puppeteer

## Claude 20x #2 — Data Verticals
- Owns: `packages/planningpulse/`, `packages/housesignal/`, `packages/agilepilot/`
- Worktree: `feat/data-verticals`
- Next: Resend email digests for planning alerts, Companies House API key, cron scheduler

## Shared Rules
1. Read `CONTRACTS.md` before any interface change
2. Never duplicate Stripe/Twilio/Grok clients — use `@rte/core`
3. All new routes go in `apps/api/src/index.ts` with CONTRACTS.md update
4. Demo mode must always work without API keys