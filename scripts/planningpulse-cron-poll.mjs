#!/usr/bin/env node
/**
 * External PlanningPulse poller for Render Cron (free-tier RTE sleeps otherwise).
 * Usage: node scripts/planningpulse-cron-poll.mjs
 */
const base = (process.env.RTE_URL || 'https://red-tape-engine.onrender.com').replace(/\/$/, '');
const secret = process.env.PLANNINGPULSE_CRON_SECRET || process.env.CRON_SECRET;

const headers = { 'Content-Type': 'application/json' };
if (secret) headers.Authorization = `Bearer ${secret}`;

const res = await fetch(`${base}/api/planningpulse/poll`, {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
});

const text = await res.text();
if (!res.ok) {
  console.error(`PlanningPulse poll failed (${res.status}):`, text.slice(0, 500));
  process.exit(1);
}

console.log(text);