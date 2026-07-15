import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DASHBOARD_PORT ?? 3848);
const API_URL = process.env.APP_URL ?? 'http://localhost:3847';

const app = Fastify({ logger: true });

await app.register(fastifyStatic, {
  root: join(__dirname, '../public'),
  prefix: '/',
});

app.get('/api/proxy/overview', async () => {
  const res = await fetch(`${API_URL}/api/dashboard/overview`);
  return res.json();
});

app.get('/api/proxy/tradetap/:tenantId/stats', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  const res = await fetch(`${API_URL}/api/tradetap/stats/${tenantId}`);
  return res.json();
});

app.get('/api/proxy/tradetap/:tenantId/report', async (req) => {
  const { tenantId } = req.params as { tenantId: string };
  const res = await fetch(`${API_URL}/api/tradetap/report/${tenantId}`);
  return res.text();
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Red Tape Engine Dashboard → http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}