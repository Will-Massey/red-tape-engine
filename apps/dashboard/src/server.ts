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

app.get('/api/proxy/tradetap/:tenantId/report', async (req, reply) => {
  const { tenantId } = req.params as { tenantId: string };
  const { format } = req.query as { format?: string };

  const res = await fetch(
    `${API_URL}/api/tradetap/report/${tenantId}${format === 'pdf' ? '?format=pdf' : ''}`,
  );

  if (format === 'pdf') {
    // Must go through as bytes — res.text() would corrupt the PDF.
    const pdf = Buffer.from(await res.arrayBuffer());
    return reply
      .status(res.status)
      .type(res.headers.get('content-type') ?? 'application/pdf')
      .header(
        'content-disposition',
        res.headers.get('content-disposition') ?? `attachment; filename="tradetap-weekly.pdf"`,
      )
      .send(pdf);
  }

  return reply.type('text/plain').send(await res.text());
});

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Red Tape Engine Dashboard → http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}