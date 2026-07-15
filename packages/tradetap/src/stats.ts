import { and, count, eq, gte, sql, sum } from 'drizzle-orm';
import { db, schema } from '@rte/core';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface TradeTapStats {
  period: string;
  missedCalls: number;
  recoveredJobs: number;
  recoveryRate: number;
  attributedRevenuePence: number;
  attributedRevenueGbp: string;
}

export async function getTradeTapStats(tenantId: string): Promise<TradeTapStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const [calls] = await db
    .select({ total: count() })
    .from(schema.missedCalls)
    .where(and(eq(schema.missedCalls.tenantId, tenantId), gte(schema.missedCalls.createdAt, weekAgo)));

  const [recovered] = await db
    .select({ total: count() })
    .from(schema.missedCalls)
    .where(
      and(
        eq(schema.missedCalls.tenantId, tenantId),
        eq(schema.missedCalls.recovered, 1),
        gte(schema.missedCalls.createdAt, weekAgo),
      ),
    );

  const [revenue] = await db
    .select({ total: sum(schema.bookings.estimatedValuePence) })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.tenantId, tenantId), gte(schema.bookings.createdAt, weekAgo)));

  const recoveryRate =
    calls?.total && calls.total > 0
      ? Math.round(((recovered?.total ?? 0) / calls.total) * 100)
      : 0;

  return {
    period: '7d',
    missedCalls: calls?.total ?? 0,
    recoveredJobs: recovered?.total ?? 0,
    recoveryRate,
    attributedRevenuePence: Number(revenue?.total ?? 0),
    attributedRevenueGbp: (Number(revenue?.total ?? 0) / 100).toFixed(2),
  };
}

export async function getRecentBookings(tenantId: string, limit = 5) {
  return db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.tenantId, tenantId))
    .orderBy(sql`${schema.bookings.createdAt} DESC`)
    .limit(limit);
}

/** Classification counts for the last 7 days, highest first. */
export async function getTriageBreakdown(tenantId: string) {
  const weekAgo = new Date(Date.now() - WEEK_MS);

  return db
    .select({
      classification: schema.missedCalls.triageClassification,
      total: count(),
    })
    .from(schema.missedCalls)
    .where(and(eq(schema.missedCalls.tenantId, tenantId), gte(schema.missedCalls.createdAt, weekAgo)))
    .groupBy(schema.missedCalls.triageClassification)
    .orderBy(sql`count(*) DESC`);
}
