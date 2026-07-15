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

## PlanningPulse

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
| POST | /api/complybot/receipt | complybot |
| GET | /api/complybot/expenses/:tenantId | complybot |
| POST | /api/planningpulse/subscribe | planningpulse |
| POST | /api/planningpulse/poll | planningpulse |
| GET | /api/planningpulse/alerts/:tenantId | planningpulse |
| GET | /api/agilepilot/slots | agilepilot |
| POST | /api/housesignal/scan | housesignal |
| GET | /api/housesignal/signals | housesignal |
| GET | /api/dashboard/overview | core |