# Capstone Command — Integration Setup

Wire Reach (email) ↔ CallForge (voice) in ~15 minutes.

## 1. Generate shared secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the same value everywhere as `CAPSTONE_WEBHOOK_SECRET`.

## 2. CallForge (Render env)

```bash
CAPSTONE_WEBHOOK_SECRET=<secret>
REACH_WEBHOOK_URL=https://reach.capstonesoftware.co.uk/api/webhooks/callforge

# Handoff target — your CallForge account + TradeTap campaign UUIDs
CALLFORGE_HANDOFF_ACCOUNT_ID=<account-uuid>
CALLFORGE_CAMPAIGN_TRADETAP=<campaign-uuid>
CALLFORGE_CAMPAIGN_DEFAULT=<campaign-uuid>   # fallback
```

Seed the TradeTap voice campaign (after unsuspending CallForge on Render):

```bash
cd ~/projects/callforge
DB_PATH=/var/data/callforge.db node scripts/seed-tradetap-voice.mjs
# Copy the printed CALLFORGE_CAMPAIGN_TRADETAP into Render env, then redeploy
```

Get UUIDs from CallForge dashboard or:

```bash
curl -H "X-API-Key: $ACCOUNT_API_KEY" https://callforge-ruau.onrender.com/api/campaigns
```

> **Note:** CallForge is currently suspended on Render — unsuspend before setting env vars or seeding.

## 3. Reach (Render env)

```bash
CAPSTONE_WEBHOOK_SECRET=<same-secret>
INTERESTED_WEBHOOK_URL=https://callforge-ruau.onrender.com/api/webhooks/reach
```

## 4. Seed TradeTap campaign in Reach

```bash
cd ~/projects/reach && node server/scripts/seed-tradetap.mjs
```

## 5. Test the bus

**Reach → CallForge (simulate warm handoff):**

```bash
curl -X POST https://callforge-ruau.onrender.com/api/webhooks/reach \
  -H "Authorization: Bearer $CAPSTONE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "interested_reply",
    "product": "tradetap",
    "email": "test@example.com",
    "firstName": "Test",
    "company": "Test Accountants",
    "phone": "+447700900123",
    "excerpt": "Yes demo please"
  }'
```

**CallForge → Reach (simulate meeting booked):**

```bash
curl -X POST https://reach.capstonesoftware.co.uk/api/webhooks/callforge \
  -H "Authorization: Bearer $CAPSTONE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "meeting.booked",
    "product": "tradetap",
    "email": "partner@known-lead.co.uk",
    "outcome": "meeting_booked",
    "summary": "Demo booked Thursday 2pm",
    "meetingBookedAt": "2026-07-17T14:00:00.000Z"
  }'
```

## Flow diagram

```
Prospect replies "demo" to TradeTap email (Reach)
    → classify: interested
    → POST /api/webhooks/reach (CallForge)
    → lead queued priority 10 + TPS check
    → Grok Voice calls within call window
    → meeting booked on call
    → POST /api/webhooks/callforge (Reach)
    → pipeline stage: meeting + prep task created
```

## 6. Stripe (RTE production)

Webhook endpoint for Render:

```
https://red-tape-engine.onrender.com/webhooks/stripe
```

Events: `checkout.session.completed`, `customer.subscription.deleted`

Re-create prices if needed:

```bash
STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs
```

## 7. PlanningPulse cron

Render cron job `rte-planningpulse-daily` hits `POST /api/planningpulse/poll` at 06:00 UTC
with `PLANNINGPULSE_CRON_SECRET`. In-process poller is disabled on Render (`PLANNINGPULSE_POLL_ENABLED=false`).

## 8. Accountant outreach batch

```bash
# Log into Reach → copy token from /api/auth/login response
REACH_API_TOKEN=eyJ... node scripts/launch-tradetap-outreach.mjs
REACH_API_TOKEN=eyJ... node scripts/launch-tradetap-outreach.mjs --launch  # after mailboxes attached
```

Lead CSV: `sales/accountant-leads-starter.csv` (30 UK firms — verify before live send).

## Contracts

Full payload shapes: `WEBHOOK_CONTRACTS.md`