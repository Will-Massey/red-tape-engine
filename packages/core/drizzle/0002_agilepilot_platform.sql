CREATE TABLE IF NOT EXISTS "load_shift_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"api_key" text NOT NULL,
	"brand" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "load_shift_partners_slug_uidx" ON "load_shift_partners" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "load_shift_partners_api_key_uidx" ON "load_shift_partners" ("api_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "savings_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"partner_id" uuid,
	"provider" text NOT NULL,
	"region" text,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"price_pence_per_kwh" double precision NOT NULL,
	"baseline_pence" double precision NOT NULL,
	"kwh" double precision NOT NULL,
	"savings_pence" double precision NOT NULL,
	"carbon_g_co2_per_kwh" double precision,
	"policy_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "load_shift_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "device_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_type" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_partner_id_load_shift_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."load_shift_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "load_shift_policies" ADD CONSTRAINT "load_shift_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_webhook_events" ADD CONSTRAINT "device_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "savings_ledger_tenant_idx" ON "savings_ledger" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "savings_ledger_partner_idx" ON "savings_ledger" ("partner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "load_shift_policies_tenant_idx" ON "load_shift_policies" ("tenant_id");
