import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  schema,
  triageMissedCall,
  sendSms,
  twimlMissedCall,
  logUsage,
} from '@rte/core';
import {
  BOOKING_CANCELLING_EVENTS,
  BOOKING_CREATING_EVENTS,
  parseCalcomWebhook,
} from './calcom.js';
import { getTenant } from './tenants.js';

const RECOVERY_WINDOW_MS = 72 * 60 * 60 * 1000;
const DEFAULT_JOB_VALUE_PENCE = 15000;

export * from './calcom.js';
export * from './tenants.js';
export * from './stats.js';
export * from './report.js';

function avgJobValuePence(tenant: { config: unknown } | null): number {
  const configured = (tenant?.config as Record<string, unknown> | undefined)?.avgJobValuePence;
  return typeof configured === 'number' ? configured : DEFAULT_JOB_VALUE_PENCE;
}

export async function handleMissedCallWebhook(input: {
  callSid: string;
  from: string;
  to: string;
  tenantId: string;
  voicemailTranscript?: string;
}) {
  const tenant = await getTenant(input.tenantId);

  if (!tenant) {
    throw new Error(`Tenant not found: ${input.tenantId}`);
  }

  // Twilio retries webhooks on timeout/5xx. call_sid is unique, so without this
  // guard a retry both texts the caller twice and throws on insert.
  const [existing] = await db
    .select()
    .from(schema.missedCalls)
    .where(eq(schema.missedCalls.callSid, input.callSid))
    .limit(1);

  if (existing) {
    return {
      duplicate: true,
      triage: {
        classification: existing.triageClassification,
        replyMessage: existing.smsSent,
      },
      sms: null,
      twiml: twimlMissedCall(),
    };
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
  smsBody = smsBody.slice(0, 320).trim();

  const sms = await sendSms(input.from, smsBody);

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

  return { duplicate: false, triage, sms, twiml: twimlMissedCall() };
}

/** Marks the missed call this booking recovered, if one is in the 72h window. */
async function markRecovered(input: {
  tenantId: string;
  phone: string | null;
  callSid?: string | null;
}): Promise<boolean> {
  if (input.callSid) {
    const updated = await db
      .update(schema.missedCalls)
      .set({ recovered: 1 })
      .where(
        and(
          eq(schema.missedCalls.callSid, input.callSid),
          eq(schema.missedCalls.tenantId, input.tenantId),
        ),
      )
      .returning({ id: schema.missedCalls.id });

    if (updated.length > 0) return true;
  }

  if (!input.phone) return false;

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
    .orderBy(sql`${schema.missedCalls.createdAt} DESC`)
    .limit(1);

  if (!recentCall) return false;

  await db
    .update(schema.missedCalls)
    .set({ recovered: 1 })
    .where(eq(schema.missedCalls.id, recentCall.id));

  return true;
}

export async function recordBooking(input: {
  tenantId: string;
  phone: string;
  callSid?: string | null;
  calUid?: string | null;
  source: 'sms_reply' | 'cal_webhook' | 'manual';
  /** Phone known to be a real number, so it can be matched against missed calls. */
  matchPhone?: string | null;
}) {
  const tenant = await getTenant(input.tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${input.tenantId}`);

  const valuePence = avgJobValuePence(tenant);

  const inserted = await db
    .insert(schema.bookings)
    .values({
      tenantId: input.tenantId,
      callSid: input.callSid ?? null,
      calUid: input.calUid ?? null,
      phone: input.phone,
      source: input.source,
      estimatedValuePence: valuePence,
    })
    .onConflictDoNothing({ target: schema.bookings.calUid })
    .returning({ id: schema.bookings.id });

  if (inserted.length === 0) {
    return { ok: true, duplicate: true, recovered: false, estimatedValuePence: valuePence };
  }

  const recovered = await markRecovered({
    tenantId: input.tenantId,
    phone: input.matchPhone ?? input.phone,
    callSid: input.callSid,
  });

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'tradetap',
    action: 'booking_created',
    metadata: {
      phone: input.phone,
      valuePence,
      source: input.source,
      recovered,
      calUid: input.calUid ?? null,
    },
  });

  return { ok: true, duplicate: false, recovered, estimatedValuePence: valuePence };
}

/**
 * Back-compat entry point for manual/simulated bookings.
 * Real Cal.com deliveries go through handleCalcomEvent.
 */
export async function handleCalcomWebhook(input: {
  tenantId: string;
  phone: string;
  callSid?: string;
}) {
  const result = await recordBooking({
    tenantId: input.tenantId,
    phone: input.phone,
    callSid: input.callSid,
    source: input.callSid ? 'sms_reply' : 'cal_webhook',
  });

  return { ok: result.ok, estimatedValuePence: result.estimatedValuePence };
}

/** Handles a parsed real Cal.com webhook delivery. */
export async function handleCalcomEvent(input: { body: unknown; tenantIdFallback?: string }) {
  const parsed = parseCalcomWebhook(input.body);
  if (!parsed) {
    return { ok: false, ignored: true, reason: 'unparseable_payload' as const };
  }

  const tenantId = parsed.tenantId ?? input.tenantIdFallback;
  if (!tenantId) {
    return { ok: false, ignored: true, reason: 'no_tenant' as const, triggerEvent: parsed.triggerEvent };
  }

  if (BOOKING_CANCELLING_EVENTS.includes(parsed.triggerEvent)) {
    if (!parsed.uid) {
      return { ok: false, ignored: true, reason: 'no_uid' as const, triggerEvent: parsed.triggerEvent };
    }

    // A cancelled booking must stop counting toward attributed revenue.
    const removed = await db
      .delete(schema.bookings)
      .where(and(eq(schema.bookings.calUid, parsed.uid), eq(schema.bookings.tenantId, tenantId)))
      .returning({ id: schema.bookings.id });

    if (removed.length > 0) {
      await logUsage({
        tenantId,
        vertical: 'tradetap',
        action: 'booking_cancelled',
        metadata: { calUid: parsed.uid, triggerEvent: parsed.triggerEvent },
      });
    }

    return {
      ok: true,
      cancelled: removed.length > 0,
      triggerEvent: parsed.triggerEvent,
      calUid: parsed.uid,
    };
  }

  if (!BOOKING_CREATING_EVENTS.includes(parsed.triggerEvent)) {
    return { ok: true, ignored: true, reason: 'unhandled_trigger' as const, triggerEvent: parsed.triggerEvent };
  }

  // Keep the booking (and its revenue) even if the booker skipped the phone field —
  // it just can't be matched back to a missed call.
  const phone = parsed.phone ?? parsed.attendeeEmail ?? 'unknown';

  const result = await recordBooking({
    tenantId,
    phone,
    callSid: parsed.callSid,
    calUid: parsed.uid,
    source: parsed.callSid ? 'sms_reply' : 'cal_webhook',
    matchPhone: parsed.phone,
  });

  return {
    ok: true,
    triggerEvent: parsed.triggerEvent,
    calUid: parsed.uid,
    duplicate: result.duplicate,
    recovered: result.recovered,
    estimatedValuePence: result.estimatedValuePence,
  };
}

