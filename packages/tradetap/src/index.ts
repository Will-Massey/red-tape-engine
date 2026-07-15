import { and, count, eq, gte, sql, sum } from 'drizzle-orm';
import {
  db,
  schema,
  triageMissedCall,
  sendSms,
  twimlMissedCall,
  logUsage,
} from '@rte/core';

const RECOVERY_WINDOW_MS = 72 * 60 * 60 * 1000;

export async function handleMissedCallWebhook(input: {
  callSid: string;
  from: string;
  to: string;
  tenantId: string;
  voicemailTranscript?: string;
}) {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant not found: ${input.tenantId}`);
  }

  const config = tenant.config as Record<string, string>;
  const triage = await triageMissedCall({
    from: input.from,
    tradeType: config.tradeType ?? 'trades',
    businessName: tenant.name,
    bookingUrl: config.bookingUrl ?? process.env.CALCOM_BOOKING_URL ?? 'https://cal.com/demo',
    voicemailTranscript: input.voicemailTranscript,
  });

  let smsBody = triage.replyMessage;
  if (triage.includeBookingLink && !smsBody.includes('http')) {
    smsBody += ` ${config.bookingUrl ?? ''}`;
  }

  const sms = await sendSms(input.from, smsBody.slice(0, 320));

  await db.insert(schema.missedCalls).values({
    tenantId: input.tenantId,
    callSid: input.callSid,
    fromPhone: input.from,
    toPhone: input.to,
    triageClassification: triage.classification,
    smsSent: smsBody,
    recovered: 0,
  });

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'tradetap',
    action: 'missed_call_triaged',
    metadata: { classification: triage.classification, urgency: triage.urgency, smsSid: sms.sid },
  });

  return { triage, sms, twiml: twimlMissedCall() };
}

export async function handleCalcomWebhook(input: {
  tenantId: string;
  phone: string;
  callSid?: string;
}) {
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);

  const config = tenant?.config as Record<string, number> | undefined;
  const avgJob = config?.avgJobValuePence ?? 15000;

  await db.insert(schema.bookings).values({
    tenantId: input.tenantId,
    callSid: input.callSid,
    phone: input.phone,
    source: input.callSid ? 'sms_reply' : 'cal_webhook',
    estimatedValuePence: avgJob,
  });

  if (input.callSid) {
    await db
      .update(schema.missedCalls)
      .set({ recovered: 1 })
      .where(
        and(
          eq(schema.missedCalls.callSid, input.callSid),
          eq(schema.missedCalls.tenantId, input.tenantId),
        ),
      );
  } else {
    const windowStart = new Date(Date.now() - RECOVERY_WINDOW_MS);
    const [recentCall] = await db
      .select()
      .from(schema.missedCalls)
      .where(
        and(
          eq(schema.missedCalls.tenantId, input.tenantId),
          eq(schema.missedCalls.fromPhone, input.phone),
          gte(schema.missedCalls.createdAt, windowStart),
        ),
      )
      .limit(1);

    if (recentCall) {
      await db
        .update(schema.missedCalls)
        .set({ recovered: 1 })
        .where(eq(schema.missedCalls.id, recentCall.id));
    }
  }

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'tradetap',
    action: 'booking_created',
    metadata: { phone: input.phone, valuePence: avgJob },
  });

  return { ok: true, estimatedValuePence: avgJob };
}

export async function getTradeTapStats(tenantId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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

export async function generateWeeklyReport(tenantId: string): Promise<string> {
  const stats = await getTradeTapStats(tenantId);
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  const recentBookings = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.tenantId, tenantId))
    .orderBy(sql`${schema.bookings.createdAt} DESC`)
    .limit(5);

  const lines = [
    `TRADETAP WEEKLY REPORT — ${tenant?.name ?? tenantId}`,
    `Period: Last 7 days`,
    ``,
    `Missed calls:     ${stats.missedCalls}`,
    `Jobs recovered:   ${stats.recoveredJobs}`,
    `Recovery rate:    ${stats.recoveryRate}%`,
    `Revenue attributed: £${stats.attributedRevenueGbp}`,
    ``,
    `Recent bookings:`,
    ...recentBookings.map(
      (b) =>
        `  • ${b.phone} — £${(b.estimatedValuePence / 100).toFixed(2)} (${b.source})`,
    ),
    ``,
    `Powered by Red Tape Engine / TradeTap`,
  ];

  return lines.join('\n');
}