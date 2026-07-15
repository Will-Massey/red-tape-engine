import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { join } from 'node:path';
import {
  db,
  schema,
  createCheckoutSession,
  handleStripeWebhook,
  isDemoMode,
  logUsage,
  validateTwilioSignature,
  isTwilioSignatureRequired,
} from '@rte/core';
import {
  handleMissedCallWebhook,
  handleCalcomWebhook,
  handleCalcomEvent,
  verifyCalcomSignature,
  resolveTenantByTwilioNumber,
  getTradeTapStats,
  generateWeeklyReport,
  generateWeeklyReportPdf,
  weeklyReportFilename,
  getTenant,
} from '@rte/tradetap';
import {
  processReceipt,
  processReceiptUpload,
  getExpenses,
  generateMtdExportPack,
  ReceiptRejected,
  MAX_RECEIPT_BYTES,
} from '@rte/complybot';
import { createSubscription, pollAndMatch, getAlerts } from '@rte/planningpulse';
import { startDailyPoller } from '@rte/planningpulse/scheduler';
import { getCheapSlots, getSlotHistory } from '@rte/agilepilot';
import { scanCompanies, getSignals } from '@rte/housesignal';
import { eq } from 'drizzle-orm';

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3847);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(formbody);
await app.register(multipart, { limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 } });

// Stripe and Cal.com sign the raw bytes, so re-serialising the parsed body
// (JSON.stringify) breaks signature checks. Keep the original buffer around.
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  const buf = body as Buffer;
  req.rawBody = buf;
  try {
    done(null, buf.length ? JSON.parse(buf.toString('utf8')) : {});
  } catch (err) {
    (err as Error & { statusCode?: number }).statusCode = 400;
    done(err as Error, undefined);
  }
});

/**
 * Twilio signs the exact URL it requested. Behind Render's proxy the incoming
 * protocol is http, so trust the forwarded headers (or an explicit override).
 */
function twilioRequestUrl(req: {
  headers: Record<string, unknown>;
  url: string;
  protocol: string;
}): string {
  const override = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (override) return `${override.replace(/\/$/, '')}${req.url}`;

  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  return `${proto}://${host}${req.url}`;
}

app.get('/health', async () => ({
  ok: true,
  service: 'red-tape-engine',
  demoMode: isDemoMode(),
  twilioSignatureEnforced: isTwilioSignatureRequired(),
  verticals: ['tradetap', 'complybot', 'planningpulse', 'agilepilot', 'housesignal'],
  timestamp: new Date().toISOString(),
}));

// ─── TradeTap ───────────────────────────────────────────────

app.post('/webhooks/twilio/voice', async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, string>;

  if (
    !validateTwilioSignature({
      signature: req.headers['x-twilio-signature'] as string | undefined,
      url: twilioRequestUrl(req),
      params: body,
    })
  ) {
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }

  // Prefer mapping the dialled number to its tenant; the query param is a
  // fallback for demo/manual calls where no number is provisioned yet.
  const mapped = body.To ? await resolveTenantByTwilioNumber(body.To) : null;
  const tenantId = mapped?.id ?? (req.query as Record<string, string>).tenantId;

  if (!tenantId) {
    return reply.status(400).send({
      error: 'Unknown Twilio number',
      message: `No tradetap tenant has config.twilioNumber matching ${body.To ?? '(missing To)'}, and no tenantId query param was supplied.`,
    });
  }

  const result = await handleMissedCallWebhook({
    callSid: body.CallSid ?? `CA_${Date.now()}`,
    from: body.From ?? '',
    to: body.To ?? '',
    tenantId,
    voicemailTranscript: body.TranscriptionText,
  });

  reply.type('text/xml').send(result.twiml);
});

app.post('/webhooks/twilio/sms', async (req, reply) => {
  const body = (req.body ?? {}) as Record<string, string>;

  if (
    !validateTwilioSignature({
      signature: req.headers['x-twilio-signature'] as string | undefined,
      url: twilioRequestUrl(req),
      params: body,
    })
  ) {
    return reply.status(403).send({ error: 'Invalid Twilio signature' });
  }

  const mapped = body.To ? await resolveTenantByTwilioNumber(body.To) : null;
  if (mapped) {
    await logUsage({
      tenantId: mapped.id,
      vertical: 'tradetap',
      action: 'sms_received',
      metadata: { from: body.From, body: body.Body, messageSid: body.MessageSid },
    });
  }

  // Twilio expects TwiML; an empty Response means "no auto-reply".
  reply.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  return reply;
});

app.post('/webhooks/calcom', async (req, reply) => {
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf-8');

  if (!verifyCalcomSignature(rawBody, req.headers['x-cal-signature-256'] as string | undefined)) {
    return reply.status(403).send({ error: 'Invalid Cal.com signature' });
  }

  const query = req.query as Record<string, string>;
  const result = await handleCalcomEvent({ body: req.body, tenantIdFallback: query.tenantId });

  // Legacy flat shape ({ tenantId, phone }) used by manual/demo calls.
  if (!result.ok && result.reason === 'unparseable_payload') {
    const body = (req.body ?? {}) as Record<string, string>;
    const tenantId = body.tenantId ?? query.tenantId;
    if (tenantId && (body.phone || body.attendeePhone)) {
      return handleCalcomWebhook({
        tenantId,
        phone: body.phone ?? body.attendeePhone,
        callSid: body.callSid,
      });
    }
    return reply.status(400).send(result);
  }

  if (!result.ok && result.reason === 'no_tenant') {
    return reply.status(400).send({
      ...result,
      message:
        'No tenant on the booking. Add ?tenantId= to the Cal.com webhook URL or set metadata.tenantId on the booking.',
    });
  }

  return result;
});

app.get('/api/tradetap/stats/:tenantId', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  return getTradeTapStats(tenantId);
});

app.get('/api/tradetap/report/:tenantId', async (req, reply) => {
  const { tenantId } = req.params as { tenantId: string };
  const { format } = req.query as { format?: string };

  if (format === 'pdf') {
    const tenant = await getTenant(tenantId);
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const pdf = await generateWeeklyReportPdf(tenantId);
    return reply
      .type('application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="${weeklyReportFilename(tenant.name)}"`,
      )
      .send(pdf);
  }

  const report = await generateWeeklyReport(tenantId);
  reply.type('text/plain').send(report);
});

app.post('/api/tradetap/simulate', async (req) => {
  const { tenantId, from, transcript } = req.body as {
    tenantId: string;
    from?: string;
    transcript?: string;
  };

  return handleMissedCallWebhook({
    callSid: `CA_sim_${Date.now()}`,
    from: from ?? '+447700900999',
    to: '+447700900100',
    tenantId,
    voicemailTranscript: transcript ?? 'Hi, got a burst pipe, need someone urgently',
  });
});

// ─── ComplyBot ──────────────────────────────────────────────

app.post('/api/complybot/receipt', async (req, reply) => {
  // multipart → a real file upload; JSON { rawText } stays supported.
  if (req.isMultipart()) {
    let tenantId = (req.query as Record<string, string>).tenantId;
    let filename: string | undefined;
    let mimeType: string | undefined;
    let buffer: Buffer | undefined;

    try {
      // Iterate parts rather than req.file(): fields only reach us if they
      // arrive before the file, and clients order them however they like.
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          buffer = await part.toBuffer();
          filename = part.filename;
          mimeType = part.mimetype;
        } else if (part.fieldname === 'tenantId' && typeof part.value === 'string') {
          tenantId = part.value;
        }
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({
          error: `Receipt exceeds ${MAX_RECEIPT_BYTES / 1024 / 1024}MB.`,
          reason: 'file_too_large',
        });
      }
      throw err;
    }

    if (!tenantId) return reply.status(400).send({ error: 'tenantId required', reason: 'missing_tenant' });
    if (!buffer) return reply.status(400).send({ error: 'file field required', reason: 'missing_file' });

    try {
      return await processReceiptUpload({
        tenantId,
        filename: filename ?? 'receipt',
        mimeType: mimeType ?? 'application/octet-stream',
        buffer,
      });
    } catch (err) {
      if (err instanceof ReceiptRejected) {
        return reply.status(err.statusCode).send({ error: err.message, reason: err.reason });
      }
      throw err;
    }
  }

  const { tenantId, filename, rawText } = req.body as {
    tenantId: string;
    filename?: string;
    rawText: string;
  };

  return processReceipt({
    tenantId,
    filename: filename ?? 'receipt.jpg',
    rawText,
  });
});

app.get('/api/complybot/expenses/:tenantId', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  const expenses = await getExpenses(tenantId);
  return expenses;
});

app.get('/api/complybot/export/:tenantId', async (req, reply) => {
  const { tenantId } = req.params as { tenantId: string };
  const expenses = await getExpenses(tenantId);
  const pack = generateMtdExportPack(tenantId, expenses);
  reply.type('text/plain').send(pack);
});

// ─── PlanningPulse ──────────────────────────────────────────

app.post('/api/planningpulse/subscribe', async (req) => {
  const { tenantId, name, lat, lng, radiusMetres } = req.body as {
    tenantId: string;
    name: string;
    lat: number;
    lng: number;
    radiusMetres?: number;
  };

  return createSubscription({ tenantId, name, lat, lng, radiusMetres });
});

app.post('/api/planningpulse/poll', async (req) => {
  const { tenantId } = (req.body as { tenantId?: string }) ?? {};
  return pollAndMatch(tenantId);
});

app.get('/api/planningpulse/alerts/:tenantId', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  return getAlerts(tenantId);
});

// ─── AgilePilot ─────────────────────────────────────────────

app.get('/api/agilepilot/slots', async (req) => {
  const { tenantId, region, history } = req.query as {
    tenantId?: string;
    region?: string;
    history?: string;
  };
  return getCheapSlots({ tenantId, region, includeHistory: history === 'true' });
});

app.get('/api/agilepilot/history/:tenantId', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  const { days } = req.query as { days?: string };
  return getSlotHistory(tenantId, { days: days ? Number(days) : undefined });
});

// ─── HouseSignal ────────────────────────────────────────────

app.post('/api/housesignal/scan', async (req) => {
  const { tenantId, sicCodes } = (req.body as { tenantId?: string; sicCodes?: string[] }) ?? {};
  return scanCompanies({ tenantId, sicCodes });
});

app.get('/api/housesignal/signals', async (req) => {
  const { limit } = req.query as { limit?: string };
  return getSignals(limit ? Number(limit) : 50);
});

// ─── Stripe + Dashboard ─────────────────────────────────────

app.post('/webhooks/stripe', async (req, reply) => {
  const sig = req.headers['stripe-signature'] as string;
  // Must be the raw bytes — Stripe's signature is over the exact payload.
  const payload = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf-8');

  try {
    return await handleStripeWebhook(payload, sig);
  } catch (err) {
    req.log.error({ err }, 'Stripe webhook verification failed');
    return reply.status(400).send({ error: (err as Error).message });
  }
});

app.post('/api/checkout', async (req) => {
  const { tenantId, vertical, email } = req.body as {
    tenantId: string;
    vertical: 'tradetap' | 'complybot' | 'planningpulse' | 'agilepilot' | 'housesignal';
    email?: string;
  };
  return createCheckoutSession({ tenantId, vertical, customerEmail: email });
});

app.get('/api/dashboard/overview', async () => {
  const allTenants = await db.select().from(schema.tenants);
  const overview = [];

  for (const tenant of allTenants) {
    let metrics: Record<string, unknown> = { vertical: tenant.vertical, plan: tenant.plan };

    if (tenant.vertical === 'tradetap') {
      metrics = { ...metrics, ...(await getTradeTapStats(tenant.id)) };
    } else if (tenant.vertical === 'complybot') {
      const exp = await getExpenses(tenant.id);
      metrics = { ...metrics, totalExpenses: exp.totalGbp, count: exp.expenses.length };
    } else if (tenant.vertical === 'planningpulse') {
      const alerts = await getAlerts(tenant.id);
      metrics = { ...metrics, alertCount: alerts.length };
    } else if (tenant.vertical === 'agilepilot') {
      const slots = await getCheapSlots({ tenantId: tenant.id });
      metrics = {
        ...metrics,
        cheapestSlot: slots.cheapest?.pricePencePerKwh,
        savings: slots.savingsEstimate,
      };
    } else if (tenant.vertical === 'housesignal') {
      const signals = await getSignals(10);
      metrics = { ...metrics, recentSignals: signals.length };
    }

    overview.push({ id: tenant.id, name: tenant.name, ...metrics });
  }

  return { tenants: overview, demoMode: isDemoMode() };
});

app.get('/api/tenants', async () => db.select().from(schema.tenants));

app.get('/api/tenants/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id)).limit(1);
  if (!tenant) return reply.status(404).send({ error: 'Not found' });
  return tenant;
});

// Dashboard proxy routes (same-origin for production)
app.get('/api/proxy/overview', async () => {
  const allTenants = await db.select().from(schema.tenants);
  const overview = [];
  for (const tenant of allTenants) {
    let metrics: Record<string, unknown> = { vertical: tenant.vertical, plan: tenant.plan };
    if (tenant.vertical === 'tradetap') {
      metrics = { ...metrics, ...(await getTradeTapStats(tenant.id)) };
    } else if (tenant.vertical === 'complybot') {
      const exp = await getExpenses(tenant.id);
      metrics = { ...metrics, totalExpenses: exp.totalGbp, count: exp.expenses.length };
    } else if (tenant.vertical === 'planningpulse') {
      const alerts = await getAlerts(tenant.id);
      metrics = { ...metrics, alertCount: alerts.length };
    } else if (tenant.vertical === 'agilepilot') {
      const slots = await getCheapSlots({ tenantId: tenant.id });
      metrics = { ...metrics, cheapestSlot: slots.cheapest?.pricePencePerKwh, savings: slots.savingsEstimate };
    } else if (tenant.vertical === 'housesignal') {
      const signals = await getSignals(10);
      metrics = { ...metrics, recentSignals: signals.length };
    }
    overview.push({ id: tenant.id, name: tenant.name, ...metrics });
  }
  return { tenants: overview, demoMode: isDemoMode() };
});

app.get('/api/proxy/tradetap/:tenantId/stats', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  return getTradeTapStats(tenantId);
});

app.get('/api/proxy/tradetap/:tenantId/report', async (req, reply) => {
  const { tenantId } = req.params as { tenantId: string };
  const { format } = req.query as { format?: string };

  if (format === 'pdf') {
    const tenant = await getTenant(tenantId);
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });

    const pdf = await generateWeeklyReportPdf(tenantId);
    return reply
      .type('application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="${weeklyReportFilename(tenant.name)}"`,
      )
      .send(pdf);
  }

  const report = await generateWeeklyReport(tenantId);
  reply.type('text/plain').send(report);
});

app.get('/demo/checkout', async (req) => {
  const q = req.query as Record<string, string>;
  return {
    demo: true,
    message: 'Stripe not configured — demo checkout',
    vertical: q.vertical,
    tenantId: q.tenant,
    price: { tradetap: 99, complybot: 19, planningpulse: 49, agilepilot: 9.99, housesignal: 199 }[
      q.vertical as string
    ],
  };
});

await app.register(fastifyStatic, {
  root: join(ROOT, 'apps/dashboard/public'),
  prefix: '/',
  decorateReply: false,
});

app.setNotFoundHandler(async (req, reply) => {
  if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/webhooks') && !req.url.startsWith('/health')) {
    return reply.sendFile('index.html');
  }
  return reply.status(404).send({ error: 'Not found' });
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Red Tape Engine → http://localhost:${PORT}`);

  // In-process cron only fires while this process is alive. On Render's free
  // plan the service sleeps when idle, so a missed 6am run needs either a paid
  // instance, a Render Cron Job, or an external ping to POST /api/planningpulse/poll.
  if (process.env.PLANNINGPULSE_POLL_ENABLED !== 'false') {
    const poller = startDailyPoller({
      onResult: (result) =>
        app.log.info(
          { polled: result.polled, alerts: result.alertsGenerated, digests: result.digests },
          'PlanningPulse daily poll complete',
        ),
      onError: (error) => app.log.error({ error }, 'PlanningPulse daily poll failed'),
    });

    app.log.info(
      {
        expression: poller.expression,
        timezone: poller.timezone,
        nextRun: poller.nextRun?.toISOString(),
      },
      'PlanningPulse poller scheduled',
    );
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}