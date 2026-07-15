import { db, schema } from './db/client.js';

export async function logUsage(input: {
  tenantId: string;
  vertical: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(schema.usageEvents).values({
    tenantId: input.tenantId,
    vertical: input.vertical,
    action: input.action,
    metadata: input.metadata ?? {},
  });
}