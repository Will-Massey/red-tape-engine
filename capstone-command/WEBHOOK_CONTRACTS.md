# Capstone Webhook Bus — Contracts

Shared secret: `CAPSTONE_WEBHOOK_SECRET` (Bearer token).  
Fallback in Reach: `FOOTNOTE_WEBHOOK_SECRET` for older deploys.

## Flow 1: Reach → CallForge (warm handoff)

**Trigger:** Reach classifies inbound reply as `interested`  
**Reach env:** `INTERESTED_WEBHOOK_URL=https://callforge.example.com/api/webhooks/reach`  
**CallForge env:** `CAPSTONE_WEBHOOK_SECRET`, `CALLFORGE_HANDOFF_ACCOUNT_ID`, `CALLFORGE_CAMPAIGN_TRADETAP`

```http
POST /api/webhooks/reach
Authorization: Bearer <CAPSTONE_WEBHOOK_SECRET>
Content-Type: application/json
```

```json
{
  "event": "interested_reply",
  "product": "tradetap",
  "email": "partner@smithandco.co.uk",
  "firstName": "Sarah",
  "lastName": "Smith",
  "company": "Smith & Co Accountants",
  "title": "Partner",
  "phone": "+447700900123",
  "reachLeadId": "uuid",
  "reachCampaign": "TradeTap — Accountant white-label (Touch 1→3)",
  "subject": "Re: your plumber clients",
  "excerpt": "Yes a demo would be useful...",
  "classifiedAt": "2026-07-15T20:00:00.000Z"
}
```

**CallForge response:**

```json
{
  "ok": true,
  "queued": true,
  "leadId": "uuid",
  "campaignId": "uuid",
  "priority": 10,
  "safeToCall": true
}
```

**Skip (acknowledged, no retry):**

```json
{ "ok": true, "queued": false, "reason": "no_phone" }
{ "ok": true, "queued": false, "reason": "tps_blocked" }
{ "ok": true, "queued": false, "reason": "duplicate" }
```

## Flow 2: CallForge → Reach (call outcomes)

**Trigger:** `call.completed` or `meeting.booked`  
**CallForge env:** `REACH_WEBHOOK_URL=https://reach.capstonesoftware.co.uk/api/webhooks/callforge`

```http
POST /api/webhooks/callforge
Authorization: Bearer <CAPSTONE_WEBHOOK_SECRET>
Content-Type: application/json
```

```json
{
  "event": "meeting.booked",
  "product": "tradetap",
  "email": "partner@smithandco.co.uk",
  "phone": "+447700900123",
  "company": "Smith & Co Accountants",
  "callforgeLeadId": "uuid",
  "callforgeCallId": "uuid",
  "outcome": "meeting_booked",
  "summary": "Booked demo Thursday 2pm",
  "qualificationScore": 8,
  "meetingBookedAt": "2026-07-17T14:00:00.000Z",
  "bookingUrl": "https://cal.com/...",
  "durationSeconds": 187
}
```

**Reach stage mapping:**

| CallForge event / outcome | Reach pipeline stage |
|---------------------------|----------------------|
| `meeting.booked` | `meeting` |
| outcome `interested` | `interested` |
| outcome `callback_requested` | `interested` + task |
| outcome `not_interested` | `not_fit` |
| outcome `do_not_call` | suppress + `lost` |

## Flow 3: Red Tape Engine (future)

Product events (`demo_booked`, `subscription_started`) → Reach `/api/webhooks/conversion`

## Product registry

| product slug | Reach brand | CallForge campaign env |
|--------------|-------------|------------------------|
| `tradetap` | TradeTap | `CALLFORGE_CAMPAIGN_TRADETAP` |
| `footnote` | Footnote | `CALLFORGE_CAMPAIGN_FOOTNOTE` |
| `callforge` | CallForge | `CALLFORGE_CAMPAIGN_CALLFORGE` |
| `propertyclarity` | Property Clarity | `CALLFORGE_CAMPAIGN_PROPERTY` |

## Compliance

- Email lane and voice lane stay **separate identities** (Reach secondary domain ≠ CallForge Twilio number)
- Voice handoff only when: interested reply OR explicit phone on lead OR 48h+ email non-responder (future)
- TPS check **required** before CallForge queues warm lead
- Warm leads get `priority: 10`, `lawful_basis: legitimate_interest`