import { and, eq } from 'drizzle-orm';
import { db, schema } from '@rte/core';
import type { LoadShiftPolicy, PolicyKind } from './policy.js';
import { defaultEvPolicies } from './policy.js';

export async function listPolicies(tenantId: string): Promise<LoadShiftPolicy[]> {
  const rows = await db
    .select()
    .from(schema.loadShiftPolicies)
    .where(eq(schema.loadShiftPolicies.tenantId, tenantId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as PolicyKind,
    enabled: r.enabled === 1,
    params: (r.params ?? {}) as Record<string, unknown>,
  }));
}

export async function upsertDefaultPolicies(tenantId: string) {
  const existing = await listPolicies(tenantId);
  if (existing.length) return existing;

  const defaults = defaultEvPolicies();
  for (const p of defaults) {
    await db.insert(schema.loadShiftPolicies).values({
      tenantId,
      name: p.name,
      kind: p.kind,
      enabled: 1,
      params: p.params,
    });
  }
  return listPolicies(tenantId);
}

export async function createPolicy(
  tenantId: string,
  policy: Omit<LoadShiftPolicy, 'id'>,
) {
  const [row] = await db
    .insert(schema.loadShiftPolicies)
    .values({
      tenantId,
      name: policy.name,
      kind: policy.kind,
      enabled: policy.enabled === false ? 0 : 1,
      params: policy.params,
    })
    .returning();

  return {
    id: row.id,
    name: row.name,
    kind: row.kind as PolicyKind,
    enabled: row.enabled === 1,
    params: (row.params ?? {}) as Record<string, unknown>,
  };
}

export async function setPolicyEnabled(tenantId: string, policyId: string, enabled: boolean) {
  await db
    .update(schema.loadShiftPolicies)
    .set({ enabled: enabled ? 1 : 0 })
    .where(
      and(
        eq(schema.loadShiftPolicies.id, policyId),
        eq(schema.loadShiftPolicies.tenantId, tenantId),
      ),
    );
}
