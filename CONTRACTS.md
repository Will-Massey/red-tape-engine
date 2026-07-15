# Red Tape Engine — API Contracts

Source of truth for all vertical packages. Implement exactly; do not improvise shapes.

## Shared Types

### Tenant
```ts
interface Tenant {
  id: string;
  name: string;
  vertical: 'tradetap' | 'complybot' | 'planningpulse' | 'agilepilot' | 'housesignal';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: 'trial' | 'starter' | 'pro' | 'agency';
  config: Record<string, unknown>;
  createdAt: Date;
}
```

### UsageEvent
```ts
interface UsageEvent {
  tenantId: string;
  vertical: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

## TradeTap

### MissedCallEvent (Twilio webhook → internal)
```ts
interface MissedCallEvent {
  callSid: string;
  from: string;
  to: string;
  tenantId: string;
  timestamp: Date;
}
```

### SmsTriageResult (Grok output)
```ts
type TriageClassification = 'emergency' | 'quote' | 'callback' | 'spam';

interface SmsTriageResult {
  classification: TriageClassification;
  replyMessage: string;
  urgency: 1 | 2 | 3 | 4 | 5;
  includeBookingLink: boolean;
}
```

### BookingCreated
```ts
interface BookingCreated {
  callSid?: string;
  phone: string;
  tenantId: string;
  source: 'sms_reply' | 'cal_webhook' | 'manual';
  estimatedValuePence: number;
  createdAt: Date;
}
```

**Recovery rule:** SMS reply → booking within 72h = recovered job.

### Tenant config (vertical: 'tradetap')
```ts
interface TradeTapConfig {
  tradeType: string;          // 'plumber' — used in triage prompt
  bookingUrl: string;         // Cal.com link sent in the SMS
  avgJobValuePence: number;   // attributed revenue per booking (default 15000)
  twilioNumber: string;       // inbound number, maps the webhook back to this tenant
}
```

### Webhook security
| Webhook | Header | Enforced when |
|---------|--------|---------------|
| Twilio voice/sms | `X-Twilio-Signature` | `TWILIO_AUTH_TOKEN` set and `DEMO_MODE !== 'true'` |
| Cal.com | `X-Cal-Signature-256` | `CALCOM_WEBHOOK_SECRET` set |
| Stripe | `Stripe-Signature` | `STRIPE_SECRET_KEY` set and `DEMO_MODE !== 'true'` |

Invalid signature → `403`. Signatures are checked against the **raw** request body;
`TWILIO_WEBHOOK_BASE_URL` overrides the URL used for Twilio's signature if the
forwarded headers don't reflect the public URL.

### Tenant resolution (Twilio)
`To` → tenant whose `config.twilioNumber` matches (digits-only comparison).
Falls back to the `?tenantId` query param when no number is mapped; `400` if neither resolves.

### Cal.com webhook
Accepts the real Cal.com payload: `{ triggerEvent, createdAt, payload: { uid, bookingId, attendees[], responses{}, metadata{} } }`.

- Phone read from `responses.phone` → `responses.attendeePhoneNumber` → `responses.smsReminderNumber` → `attendees[0].phoneNumber`.
- Tenant from `payload.metadata.tenantId`, else `?tenantId`.
- `payload.metadata.callSid` attributes the booking to a specific missed call.
- `BOOKING_CREATED` / `BOOKING_PAID` create a booking; `BOOKING_CANCELLED` / `BOOKING_REJECTED` remove it so cancelled jobs stop counting as revenue; other events are acknowledged and ignored.
- Idempotent on `payload.uid` (`bookings.cal_uid`, unique) — redelivery never double-counts.
- Legacy flat body `{ tenantId, phone, callSid? }` is still accepted for manual/demo bookings.

## ComplyBot

### ReceiptUpload
```ts
interface ReceiptUpload {
  tenantId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}
```

`POST /api/complybot/receipt` accepts either `multipart/form-data`
(`tenantId` field + file part, any order) or JSON `{ tenantId, rawText }`.
Accepts `text/plain`, `text/csv` and image mime types; max 10MB.

**Open:** image receipts cannot be read. `categoriseReceipt()` in `@rte/core`
takes `{ rawText, filename }` and has no image/vision parameter, so images are
served by the demo stub in demo mode and rejected `502 receipt_unreadable` when
demo mode is off. Needs a core vision path — conductor's call.

### CategorisedExpense (Grok output)
```ts
interface CategorisedExpense {
  vendor: string;
  amountPence: number;
  date: string;
  category: 'repairs' | 'utilities' | 'insurance' | 'mortgage_interest' | 'agent_fees' | 'other';
  mtdBox: string;
  confidence: number;
}
```

Image receipts: `categoriseReceiptFromImage({ buffer, mimeType, filename })` in `@rte/core` (Grok vision). Text receipts: `categoriseReceipt({ rawText, filename })`. No second OCR path.

**Live-mode rule:** vision/API/parse failures **throw** — never `demoExpense()`. Upload maps to `502 receipt_unreadable`. Demo mode may stub for sales demos only.

## PlanningPulse

### Tenant config (vertical: 'planningpulse')
```ts
interface PlanningPulseConfig {
  digestEmail: string;  // Resend recipient for alert digests
  focus?: string;
}
```

### Email digest (`@rte/core` → `sendEmail`)
```ts
interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}
```

`sendEmail()` in `@rte/core` — demo logs to console when `RESEND_API_KEY` unset or `DEMO_MODE=true`.

### PlanningApplication
```ts
interface PlanningApplication {
  reference: string;
  lpa: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  receivedAt: string;
}
```

### PlanningAlert
```ts
interface PlanningAlert {
  tenantId: string;
  application: PlanningApplication;
  distanceMetres: number;
  signalScore: number; // 0-100
  summary: string;
}
```

## AgilePilot

### CheapSlot (Octopus Agile)
```ts
interface CheapSlot {
  start: string;
  end: string;
  pricePencePerKwh: number;
  recommendation: string;
}
```

## HouseSignal

### CompanySignal
```ts
interface CompanySignal {
  companyNumber: string;
  companyName: string;
  signalType: 'new_director' | 'accounts_filed' | 'incorporation' | 'sic_change';
  signalDate: string;
  enrichment: string;
  score: number;
}
```

## HTTP Routes

| Method | Path | Vertical |
|--------|------|----------|
| GET | /health | core |
| POST | /webhooks/twilio/voice | tradetap |
| POST | /webhooks/twilio/sms | tradetap |
| POST | /webhooks/stripe | core |
| POST | /webhooks/calcom | tradetap |
| GET | /api/tradetap/stats/:tenantId | tradetap |
| GET | /api/tradetap/report/:tenantId | tradetap |
| GET | /api/tradetap/report/:tenantId?format=pdf | tradetap |
| POST | /api/complybot/receipt | complybot |
| GET | /api/complybot/expenses/:tenantId | complybot |
| POST | /api/planningpulse/subscribe | planningpulse |
| POST | /api/planningpulse/poll | planningpulse |
| GET | /api/planningpulse/alerts/:tenantId | planningpulse |
| GET | /api/agilepilot/slots | agilepilot |
| GET | /api/agilepilot/history/:tenantId | agilepilot |
| POST | /api/housesignal/scan | housesignal |
| GET | /api/housesignal/signals | housesignal |
| GET | /api/dashboard/overview | core |