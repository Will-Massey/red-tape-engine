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

  for (const tenant of planning) {
    const [existing] = await db
      .select({ id: schema.planningSubscriptions.id })
      .from(schema.planningSubscriptions)
      .where(eq(schema.planningSubscriptions.tenantId, tenant.id))
      .limit(1);

    if (existing) continue;

    await db.insert(schema.planningSubscriptions).values({
      tenantId: tenant.id,
      name: `${tenant.name} — HQ`,
      lat: 53.466,
      lng: -2.242,
      radiusMetres: 5000,
    });
  }
}