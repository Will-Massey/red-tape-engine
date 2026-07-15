CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "vertical" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "plan" text DEFAULT 'trial' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "vertical" text NOT NULL,
  "action" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "missed_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "call_sid" text NOT NULL UNIQUE,
  "from_phone" text NOT NULL,
  "to_phone" text NOT NULL,
  "triage_classification" text,
  "sms_sent" text,
  "recovered" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "call_sid" text,
  "phone" text NOT NULL,
  "source" text NOT NULL,
  "estimated_value_pence" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "vendor" text NOT NULL,
  "amount_pence" integer NOT NULL,
  "date" text NOT NULL,
  "category" text NOT NULL,
  "mtd_box" text NOT NULL,
  "confidence" double precision NOT NULL,
  "raw_text" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "planning_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "radius_metres" integer DEFAULT 1000 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "planning_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "reference" text NOT NULL,
  "lpa" text NOT NULL,
  "description" text NOT NULL,
  "address" text NOT NULL,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "status" text NOT NULL,
  "distance_metres" integer NOT NULL,
  "signal_score" integer NOT NULL,
  "summary" text NOT NULL,
  "received_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "company_signals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_number" text NOT NULL,
  "company_name" text NOT NULL,
  "signal_type" text NOT NULL,
  "signal_date" text NOT NULL,
  "enrichment" text NOT NULL,
  "score" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);