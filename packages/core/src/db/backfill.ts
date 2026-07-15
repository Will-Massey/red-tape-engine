import { eq } from 'drizzle-orm';
import { db, schema } from './client.js';

/**
 * Idempotent config patches for tenants created before seed defaults were updated.
 * Safe to run on every deploy — only fills missing keys.
 */
export async function backfillTenantConfigs() {
  const tradetap = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.vertical, 'tradetap'));

  for (const tenant of tradetap) {
    const config = (tenant.config ?? {}) as Record<string, unknown>;
    if (config.twilioNumber) continue;

    await db
      .update(schema.tenants)
      .set({
        config: {
          ...config,
          twilioNumber: process.env.TWILIO_PHONE_NUMBER ?? '+447700900100',
        },
      })
      .where(eq(schema.tenants.id, tenant.id));
  }

  const planning = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.vertical, 'planningpulse'));

  for (const tenant of planning) {
    const config = (tenant.config ?? {}) as Record<string, unknown>;
    if (config.digestEmail) continue;

    await db
      .update(schema.tenants)
      .set({
        config: {
          ...config,
          digestEmail:
            process.env.PLANNINGPULSE_DIGEST_EMAIL ?? 'alerts@northbuild.example',
        },
      })
      .where(eq(schema.tenants.id, tenant.id));
  }
}