import { eq } from 'drizzle-orm';
import { db, schema, normalisePhone } from '@rte/core';

export type TenantRow = typeof schema.tenants.$inferSelect;

/**
 * Maps an inbound Twilio number (the `To` of a missed call) to the tenant that
 * owns it, via `config.twilioNumber`. Without this the webhook has to trust a
 * `?tenantId` query param, which any caller could point at any tenant.
 */
export async function resolveTenantByTwilioNumber(toNumber: string): Promise<TenantRow | null> {
  const digits = normalisePhone(toNumber ?? '');
  if (!digits) return null;

  const candidates = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.vertical, 'tradetap'));

  return (
    candidates.find((tenant) => {
      const configured = (tenant.config as Record<string, unknown>).twilioNumber;
      return typeof configured === 'string' && normalisePhone(configured) === digits;
    }) ?? null
  );
}

export async function getTenant(tenantId: string): Promise<TenantRow | null> {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  return tenant ?? null;
}
