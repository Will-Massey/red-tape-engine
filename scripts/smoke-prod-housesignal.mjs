#!/usr/bin/env node
/**
 * Production smoke for HouseSignal.
 * Usage: node scripts/smoke-prod-housesignal.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.APP_URL || 'https://red-tape-engine.onrender.com';
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
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

await check('health', async () => {
  const h = await json('/health');
  if (!h.ok) throw new Error('not ok');
  if (!h.verticals?.includes('housesignal')) throw new Error('missing vertical');
});

await check('landing', async () => {
  const res = await fetch(`${BASE}/housesignal.html`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(String(res.status));
});

await check('signals list', async () => {
  const s = await json('/api/housesignal/signals?limit=5');
  if (!Array.isArray(s)) throw new Error('expected array');
});

await check('scan', async () => {
  const d = await json('/api/housesignal/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!d.source) throw new Error('no source');
  if (typeof d.scanned !== 'number') throw new Error('no scanned count');
  console.log(`     source=${d.source} scanned=${d.scanned} new=${d.newSignals} skipped=${d.skipped}`);
});

await check('checkout path', async () => {
  const d = await json('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      vertical: 'housesignal',
      email: 'smoke-housesignal@capstonesoftware.co.uk',
    }),
  });
  if (!d.url && !d.sessionId && !d.id) {
    // Stripe may return url or error if price missing — surface either way
    if (d.error) throw new Error(d.error);
    throw new Error(`unexpected checkout: ${JSON.stringify(d).slice(0, 200)}`);
  }
});

if (fails.length) {
  console.error(`\n${fails.length} failed`);
  process.exit(1);
}
console.log('\nAll HouseSignal checks passed');
