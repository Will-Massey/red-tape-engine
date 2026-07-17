import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@rte/core';

export type DeviceType = 'evse' | 'battery' | 'heat_pump' | 'smart_plug' | 'other';

/**
 * Device OEM webhooks — store events only. No remote control until a partner
 * integration is signed (see enterprise strategy).
 */
export async function receiveDeviceWebhook(input: {
  tenantId: string;
  deviceType: DeviceType | string;
  event: string;
  payload?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(schema.deviceWebhookEvents)
    .values({
      tenantId: input.tenantId,
      deviceType: input.deviceType,
      event: input.event,
      payload: input.payload ?? {},
      status: 'received',
    })
    .returning();

  return {
    id: row.id,
    status: row.status,
    message:
      'Event accepted. Device control is not enabled in this build — events are logged for pilot wiring.',
  };
}

export async function listDeviceEvents(tenantId: string, limit = 50) {
  return db
    .select()
    .from(schema.deviceWebhookEvents)
    .where(eq(schema.deviceWebhookEvents.tenantId, tenantId))
    .orderBy(desc(schema.deviceWebhookEvents.createdAt))
    .limit(limit);
}
