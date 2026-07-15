/**
 * TradeTap end-to-end smoke test.
 *
 *   npm run smoke:tradetap              # against a local API (npm run dev)
 *   BASE_URL=https://red-tape-engine.onrender.com npm run smoke:tradetap
 *
 * Drives the real Twilio + Cal.com webhooks rather than internal functions:
 * missed call → SMS logged → booking recovers it → stats increment → PDF renders.
 *
 * DB assertions and cleanup only run against a local API, where .env's
 * DATABASE_URL is the same database the API is using.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(ROOT, '.env') });

const BASE_URL = (process.env.BASE_URL ?? `http://localhost:${process.env.API_PORT ?? 3847}`).replace(
  /\/$/,
  '',
);
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);
const CALL_SID = `CA_smoke_${Date.now()}`;
const CAL_UID = `cal_smoke_${Date.now()}`;
const CALLER = '+447700900931';

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** Twilio signs base64(HMAC-SHA1(url + sorted key+value pairs)). */
function twilioSignature(url: string, params: Record<string, string>, authToken: string): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  return createHmac('sha1', authToken).update(Buffer.from(payload, 'utf-8')).digest('base64');
}

async function postForm(path: string, params: Record<string, string>) {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    // Signature is over the URL Twilio would have called.
    const signedUrl = process.env.TWILIO_WEBHOOK_BASE_URL
      ? `${process.env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, '')}${path}`
      : url;
    headers['X-Twilio-Signature'] = twilioSignature(signedUrl, params, authToken);
  }

  const res = await fetch(url, { method: 'POST', headers, body: new URLSearchParams(params) });
  return { status: res.status, text: await res.text() };
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: raw,
  });

  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as any };
  } catch {
    return { status: res.status, body: text as any };
  }
}

async function getJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  return { status: res.status, body: (await res.json()) as any };
}

async function main() {
  console.log(`TradeTap smoke test → ${BASE_URL}`);

  // ── 1. Health ────────────────────────────────────────────
  section('Health');
  const health = await getJson('/health');
  check('GET /health returns ok', health.status === 200 && health.body.ok === true, health.body);
  const demoMode = health.body.demoMode === true;
  console.log(`    demoMode=${demoMode} twilioSignatureEnforced=${health.body.twilioSignatureEnforced}`);

  // ── 2. Tenant with a mapped Twilio number ────────────────
  section('Tenant resolution');
  const tenants = await getJson('/api/tenants');
  const tenant = (tenants.body as any[]).find(
    (t) => t.vertical === 'tradetap' && t.config?.twilioNumber,
  );

  if (!tenant) {
    console.error(
      '\nFAIL: no tradetap tenant with config.twilioNumber. Run `npm run db:seed`, or set it on an existing tenant.',
    );
    process.exit(1);
  }
  check('tradetap tenant has config.twilioNumber', Boolean(tenant.config.twilioNumber));
  console.log(`    ${tenant.name} → ${tenant.config.twilioNumber}`);

  const statsBefore = (await getJson(`/api/tradetap/stats/${tenant.id}`)).body;

  // ── 3. Missed call via the real Twilio webhook ───────────
  section('Missed call → SMS');
  const voice = await postForm('/webhooks/twilio/voice', {
    CallSid: CALL_SID,
    From: CALLER,
    To: tenant.config.twilioNumber,
    TranscriptionText: 'Hi, got a burst pipe, need someone urgently',
  });

  check('POST /webhooks/twilio/voice accepted', voice.status === 200, voice.status);
  check('responds with TwiML', voice.text.includes('<Response>'), voice.text.slice(0, 80));
  check(
    'tenant resolved from the To number (no tenantId param)',
    voice.status === 200 && !voice.text.includes('Unknown Twilio number'),
  );

  // ── 4. Rejects a forged signature (only when enforced) ───
  if (health.body.twilioSignatureEnforced) {
    const forged = await fetch(`${BASE_URL}/webhooks/twilio/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'obviously-wrong',
      },
      body: new URLSearchParams({ CallSid: `${CALL_SID}_forged`, From: CALLER, To: tenant.config.twilioNumber }),
    });
    check('rejects forged Twilio signature with 403', forged.status === 403, forged.status);
  } else {
    console.log('  – signature enforcement off (demo mode) — skipping forged-signature check');
  }

  // ── 5. Stats increment ──────────────────────────────────
  section('Stats');
  const statsAfterCall = (await getJson(`/api/tradetap/stats/${tenant.id}`)).body;
  check(
    `missedCalls incremented (${statsBefore.missedCalls} → ${statsAfterCall.missedCalls})`,
    statsAfterCall.missedCalls === statsBefore.missedCalls + 1,
    statsAfterCall,
  );

  // ── 6. Twilio retry must not double-text or 500 ──────────
  const retry = await postForm('/webhooks/twilio/voice', {
    CallSid: CALL_SID,
    From: CALLER,
    To: tenant.config.twilioNumber,
    TranscriptionText: 'Hi, got a burst pipe, need someone urgently',
  });
  const statsAfterRetry = (await getJson(`/api/tradetap/stats/${tenant.id}`)).body;
  check('duplicate CallSid (Twilio retry) is idempotent', retry.status === 200, retry.status);
  check(
    'retry did not double-count the call',
    statsAfterRetry.missedCalls === statsAfterCall.missedCalls,
    statsAfterRetry,
  );

  // ── 7. Cal.com booking recovers the call ────────────────
  section('Cal.com booking → recovery');
  const calPayload = {
    triggerEvent: 'BOOKING_CREATED',
    createdAt: new Date().toISOString(),
    payload: {
      uid: CAL_UID,
      bookingId: 90210,
      title: 'Emergency callout',
      startTime: new Date(Date.now() + 3600_000).toISOString(),
      attendees: [{ name: 'Smoke Tester', email: 'smoke@example.com', timeZone: 'Europe/London' }],
      responses: {
        name: { label: 'your_name', value: 'Smoke Tester' },
        phone: { label: 'phone_number', value: CALLER },
      },
      metadata: { tenantId: tenant.id, callSid: CALL_SID },
    },
  };

  const calHeaders: Record<string, string> = {};
  if (process.env.CALCOM_WEBHOOK_SECRET) {
    calHeaders['x-cal-signature-256'] = createHmac('sha256', process.env.CALCOM_WEBHOOK_SECRET)
      .update(Buffer.from(JSON.stringify(calPayload), 'utf-8'))
      .digest('hex');
  }

  const booking = await postJson('/webhooks/calcom', calPayload, calHeaders);
  check('POST /webhooks/calcom accepted', booking.status === 200, booking.body);
  check('real Cal.com payload parsed (uid extracted)', booking.body?.calUid === CAL_UID, booking.body);
  check('booking marked the missed call recovered', booking.body?.recovered === true, booking.body);

  const statsAfterBooking = (await getJson(`/api/tradetap/stats/${tenant.id}`)).body;
  check(
    `recoveredJobs incremented (${statsAfterCall.recoveredJobs} → ${statsAfterBooking.recoveredJobs})`,
    statsAfterBooking.recoveredJobs === statsAfterCall.recoveredJobs + 1,
    statsAfterBooking,
  );
  check(
    'attributed revenue increased',
    statsAfterBooking.attributedRevenuePence > statsAfterCall.attributedRevenuePence,
    { before: statsAfterCall.attributedRevenuePence, after: statsAfterBooking.attributedRevenuePence },
  );

  // ── 8. Cal.com redelivery is idempotent ─────────────────
  const replay = await postJson('/webhooks/calcom', calPayload, calHeaders);
  const statsAfterReplay = (await getJson(`/api/tradetap/stats/${tenant.id}`)).body;
  check('redelivered Cal.com booking flagged duplicate', replay.body?.duplicate === true, replay.body);
  check(
    'redelivery did not double-count revenue',
    statsAfterReplay.attributedRevenuePence === statsAfterBooking.attributedRevenuePence,
    statsAfterReplay,
  );

  // ── 9. Reports ──────────────────────────────────────────
  section('Reports');
  const textReport = await fetch(`${BASE_URL}/api/tradetap/report/${tenant.id}`);
  const reportBody = await textReport.text();
  check('text report renders', textReport.status === 200 && reportBody.includes('TRADETAP WEEKLY REPORT'));

  const pdfRes = await fetch(`${BASE_URL}/api/tradetap/report/${tenant.id}?format=pdf`);
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  check('PDF report renders', pdfRes.status === 200 && pdfBuf.subarray(0, 5).toString() === '%PDF-');
  check(
    'PDF served as an attachment',
    (pdfRes.headers.get('content-type') ?? '').includes('application/pdf') &&
      (pdfRes.headers.get('content-disposition') ?? '').includes('.pdf'),
    { type: pdfRes.headers.get('content-type'), disposition: pdfRes.headers.get('content-disposition') },
  );
  console.log(`    PDF ${pdfBuf.length} bytes`);

  // ── 10. Checkout ────────────────────────────────────────
  section('Stripe checkout');
  const checkout = await postJson('/api/checkout', {
    tenantId: tenant.id,
    vertical: 'tradetap',
    email: 'smoke@example.com',
  });
  check('POST /api/checkout returns a URL', checkout.status === 200 && Boolean(checkout.body?.url), checkout.body);
  console.log(
    `    ${checkout.body?.demo ? 'demo checkout (no STRIPE_PRICE_TRADETAP / DEMO_MODE=true)' : 'live Stripe checkout session'}`,
  );

  // ── 11. SMS actually logged (DB) ────────────────────────
  if (IS_LOCAL) {
    section('SMS persisted (database)');
    const { db, schema } = await import('@rte/core');
    const { eq } = await import('drizzle-orm');

    const [row] = await db
      .select()
      .from(schema.missedCalls)
      .where(eq(schema.missedCalls.callSid, CALL_SID))
      .limit(1);

    check('missed_calls row written', Boolean(row), row);
    check('SMS body logged to sms_sent', Boolean(row?.smsSent && row.smsSent.length > 0), row?.smsSent);
    check('triage classification stored', Boolean(row?.triageClassification), row?.triageClassification);
    check('recovered flag set by the booking', row?.recovered === 1, row?.recovered);
    console.log(`    sms_sent: "${row?.smsSent}"`);

    const usage = await db
      .select()
      .from(schema.usageEvents)
      .where(eq(schema.usageEvents.tenantId, tenant.id));
    check(
      'usage events logged (missed_call_triaged + booking_created)',
      usage.some((u) => u.action === 'missed_call_triaged') &&
        usage.some((u) => u.action === 'booking_created'),
    );

    // Cleanup so repeat runs stay clean.
    await db.delete(schema.bookings).where(eq(schema.bookings.calUid, CAL_UID));
    await db.delete(schema.missedCalls).where(eq(schema.missedCalls.callSid, CALL_SID));
    console.log('    cleaned up smoke rows');
  } else {
    console.log('\nRemote target — skipping DB assertions and cleanup.');
  }

  // ── Result ──────────────────────────────────────────────
  console.log(`\n${'─'.repeat(48)}`);
  if (failures.length > 0) {
    console.log(`FAILED — ${passed} passed, ${failures.length} failed`);
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log(`PASSED — ${passed} checks`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
