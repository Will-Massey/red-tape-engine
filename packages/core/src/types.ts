export type Vertical =
  | 'tradetap'
  | 'complybot'
  | 'planningpulse'
  | 'agilepilot'
  | 'housesignal';

export type Plan = 'trial' | 'starter' | 'pro' | 'agency';

export interface Tenant {
  id: string;
  name: string;
  vertical: Vertical;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: Plan;
  config: Record<string, unknown>;
  createdAt: Date;
}

export interface UsageEvent {
  tenantId: string;
  vertical: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type TriageClassification = 'emergency' | 'quote' | 'callback' | 'spam';

export interface MissedCallEvent {
  callSid: string;
  from: string;
  to: string;
  tenantId: string;
  timestamp: Date;
}

export interface SmsTriageResult {
  classification: TriageClassification;
  replyMessage: string;
  urgency: 1 | 2 | 3 | 4 | 5;
  includeBookingLink: boolean;
}

export interface BookingCreated {
  callSid?: string;
  phone: string;
  tenantId: string;
  source: 'sms_reply' | 'cal_webhook' | 'manual';
  estimatedValuePence: number;
  createdAt: Date;
}

export interface CategorisedExpense {
  vendor: string;
  amountPence: number;
  date: string;
  category:
    | 'repairs'
    | 'utilities'
    | 'insurance'
    | 'mortgage_interest'
    | 'agent_fees'
    | 'other';
  mtdBox: string;
  confidence: number;
}

export interface PlanningApplication {
  reference: string;
  lpa: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  receivedAt: string;
}

export interface PlanningAlert {
  tenantId: string;
  application: PlanningApplication;
  distanceMetres: number;
  signalScore: number;
  summary: string;
}

export interface CheapSlot {
  start: string;
  end: string;
  pricePencePerKwh: number;
  recommendation: string;
  carbonGCo2PerKwh?: number | null;
}

export interface CompanySignal {
  companyNumber: string;
  companyName: string;
  signalType: 'new_director' | 'accounts_filed' | 'incorporation' | 'sic_change';
  signalDate: string;
  enrichment: string;
  score: number;
}