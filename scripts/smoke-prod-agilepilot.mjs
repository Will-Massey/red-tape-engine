#!/usr/bin/env node
/**
 * Production smoke for AgilePilot / Capstone Load-Shift.
 * Usage: node scripts/smoke-prod-agilepilot.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.APP_URL || 'https://red-tape-engine.onrender.com';
const TENANT = process.env.AGILEPILOT_DEMO_TENANT_ID || '0e99308d-9a09-4620-b420-4951eacaf971';
const ADMIN = process.env.AGILEPILOT_ADMIN_KEY || '';

const fails = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (err) {
    fails.push(name);
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

await check('health', async () => {
  const h = await json('/health');
  if (!h.ok) throw new Error('not ok');
  if (!h.verticals?.includes('agilepilot')) throw new Error('missing vertical');
});

await check('providers', async () => {
  const p = await json('/api/agilepilot/providers');
  if (!Array.isArray(p) || !p.find((x) => x.id === 'octopus')) throw new Error('no octopus');
});

await check('slots live octopus', async () => {
  const d = await json('/api/agilepilot/slots?provider=octopus&enterprise=true&policy=true');
  if (!d.provider?.live) throw new Error('octopus not live');
  if (!d.slots?.length) throw new Error('no slots');
  if (!d.plan?.summary) throw new Error('no plan');
});

await check('brand', async () => {
  const b = await json('/api/agilepilot/brand/capstone-demo');
  if (b.slug !== 'capstone-demo') throw new Error('bad brand');
});

await check('policies', async () => {
  const p = await json(`/api/agilepilot/policies/${TENANT}?seed=true`);
  if (!Array.isArray(p) || p.length < 1) throw new Error('no policies');
});

await check('ledger path', async () => {
  await json(
    `/api/agilepilot/slots?tenantId=${TENANT}&policy=true&ledger=true&enterprise=true`,
  );
  const l = await json(`/api/agilepilot/ledger/${TENANT}?days=30`);
  if (typeof l.entries !== 'number') throw new Error('bad ledger');
});

await check('landing', async () => {
  const res = await fetch(`${BASE}/agilepilot.html`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(String(res.status));
});

await check('checkout', async () => {
  const d = await json('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      vertical: 'agilepilot',
      tenantId: TENANT,
      email: 'smoke@capstonesoftware.co.uk',
    }),
  });
  if (!d.url) throw new Error('no checkout url');
});

if (ADMIN) {
  await check('partners admin', async () => {
    const p = await json('/api/agilepilot/partners', {
      headers: { 'x-admin-key': ADMIN },
    });
    if (!Array.isArray(p)) throw new Error('not array');
  });
} else {
  console.log('SKIP partners admin (set AGILEPILOT_ADMIN_KEY)');
}

console.log(fails.length ? `\n${fails.length} failed` : '\nAll checks passed');
process.exit(fails.length ? 1 : 0);
