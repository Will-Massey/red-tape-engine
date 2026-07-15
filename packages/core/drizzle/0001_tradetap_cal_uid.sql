-- TradeTap: idempotency for Cal.com booking webhooks.
-- Cal.com retries deliveries, so the booking uid must be unique to avoid
-- double-counting attributed revenue. NULLs stay allowed for sms_reply/manual
-- bookings, and Postgres permits multiple NULLs under a unique index.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cal_uid" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_cal_uid_unique" ON "bookings" ("cal_uid");
