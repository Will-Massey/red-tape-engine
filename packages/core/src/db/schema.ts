import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  doublePrecision,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  vertical: text('vertical').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan: text('plan').notNull().default('trial'),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  vertical: text('vertical').notNull(),
  action: text('action').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const missedCalls = pgTable('missed_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  callSid: text('call_sid').notNull().unique(),
  fromPhone: text('from_phone').notNull(),
  toPhone: text('to_phone').notNull(),
  triageClassification: text('triage_classification'),
  smsSent: text('sms_sent'),
  recovered: integer('recovered').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  callSid: text('call_sid'),
  calUid: text('cal_uid').unique(),
  phone: text('phone').notNull(),
  source: text('source').notNull(),
  estimatedValuePence: integer('estimated_value_pence').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  vendor: text('vendor').notNull(),
  amountPence: integer('amount_pence').notNull(),
  date: text('date').notNull(),
  category: text('category').notNull(),
  mtdBox: text('mtd_box').notNull(),
  confidence: doublePrecision('confidence').notNull(),
  rawText: text('raw_text'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const planningSubscriptions = pgTable('planning_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  radiusMetres: integer('radius_metres').notNull().default(1000),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const planningAlerts = pgTable('planning_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  reference: text('reference').notNull(),
  lpa: text('lpa').notNull(),
  description: text('description').notNull(),
  address: text('address').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  status: text('status').notNull(),
  distanceMetres: integer('distance_metres').notNull(),
  signalScore: integer('signal_score').notNull(),
  summary: text('summary').notNull(),
  receivedAt: timestamp('received_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const companySignals = pgTable('company_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyNumber: text('company_number').notNull(),
  companyName: text('company_name').notNull(),
  signalType: text('signal_type').notNull(),
  signalDate: text('signal_date').notNull(),
  enrichment: text('enrichment').notNull(),
  score: integer('score').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});