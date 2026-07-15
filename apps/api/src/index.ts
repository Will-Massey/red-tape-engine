import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';
import { db, schema, createCheckoutSession, handleStripeWebhook, isDemoMode } from '@rte/core';
import {
  handleMissedCallWebhook,
  handleCalcomWebhook,
  getTradeTapStats,
  generateWeeklyReport,
} from '@rte/tradetap';
import { processReceipt, getExpenses, generateMtdExportPack } from '@rte/complybot';
import { createSubscription, pollAndMatch, getAlerts } from '@rte/planningpulse';
import { getCheapSlots } from '@rte/agilepilot';
import { scanCompanies, getSignals } from '@rte/housesignal';
import { eq } from 'drizzle-orm';

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3847);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(formbody);

app.get('/health', async () => ({
  ok: true,
  service: 'red-tape-engine',
  demoMode: isDemoMode(),
  verticals: ['tradetap', 'complybot', 'planningpulse', 'agilepilot', 'housesignal'],
  timestamp: new Date().toISOString(),
}));

// ─── TradeTap ───────────────────────────────────────────────

app.post('/webhooks/twilio/voice', async (req, reply) => {
  const body = req.body as Record<string, string>;
  const tenantId = (req.query as Record<string, string>).tenantId;

  if (!tenantId) {
    return reply.status(400).send({ error: 'tenantId query param required' });
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

app.post('/webhooks/twilio/sms', async (req) => {
  const body = req.body as Record<string, string>;
  return { received: true, from: body.From, body: body.Body };
});

app.post('/webhooks/calcom', async (req) => {
  const body = req.body as Record<string, string>;
  const tenantId = body.tenantId ?? (req.query as Record<string, string>).tenantId;
  if (!tenantId) return { error: 'tenantId required' };

  return handleCalcomWebhook({
    tenantId,
    phone: body.phone ?? body.attendeePhone ?? '+447000000000',
    callSid: body.callSid,
  });
});

app.get('/api/tradetap/stats/:tenantId', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  return getTradeTapStats(tenantId);
});

app.get('/api/tradetap/report/:tenantId', async (req, reply) => {
  const { tenantId } = req.params as { tenantId: string };
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

app.post('/api/complybot/receipt', async (req) => {
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
  const { tenantId, region } = req.query as { tenantId?: string; region?: string };
  return getCheapSlots({ tenantId, region });
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
  const result = await handleStripeWebhook(JSON.stringify(req.body), sig);
  return result;
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
} catch (err) {
  app.log.error(err);
  process.exit(1);
}