#!/usr/bin/env node
/**
 * E2E smoke test for Reach ↔ CallForge Capstone webhook bus.
 * Usage: CAPSTONE_WEBHOOK_SECRET=... node scripts/test-webhook-bus.mjs
 */
const secret = process.env.CAPSTONE_WEBHOOK_SECRET;
if (!secret) {
  console.error('Set CAPSTONE_WEBHOOK_SECRET');
  process.exit(1);
}

const callforge = (process.env.CALLFORGE_URL || 'https://callforge-ruau.onrender.com').replace(/\/$/, '');
const reach = (process.env.REACH_URL || 'https://reach.capstonesoftware.co.uk').replace(/\/$/, '');
const auth = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };

async function step(name, url, body) {
  const res = await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  const ok = res.ok;
  console.log(`${ok ? '✓' : '✗'} ${name} → ${res.status}`, JSON.stringify(data));
  return ok;
}

console.log('Testing CallForge ← Reach handoff...');
const handoffOk = await step(
  'interested_reply → CallForge',
  `${callforge}/api/webhooks/reach`,
  {
    event: 'interested_reply',
    product: 'tradetap',
    email: 'test-partner@example.com',
    firstName: 'Test',
    company: 'Test Accountants Ltd',
    phone: '+447700900123',
    excerpt: 'Yes demo please',
  },
);

console.log('\nTesting Reach ← CallForge meeting booked...');
const meetingOk = await step(
  'meeting.booked → Reach',
  `${reach}/api/webhooks/callforge`,
  {
    event: 'meeting.booked',
    product: 'tradetap',
    email: 'partner@known-lead.co.uk',
    outcome: 'meeting_booked',
    summary: 'Demo booked Thursday 2pm',
    meetingBookedAt: new Date().toISOString(),
  },
);

process.exit(handoffOk && meetingOk ? 0 : 1);