#!/usr/bin/env node
/**
 * Import accountant leads + enroll in TradeTap Reach campaign.
 *
 * Requires REACH_API_TOKEN (JWT from Reach login) or run seed locally with DATABASE_URL.
 *
 * Usage:
 *   REACH_API_TOKEN=eyJ... node scripts/launch-tradetap-outreach.mjs
 *   REACH_API_TOKEN=eyJ... node scripts/launch-tradetap-outreach.mjs --launch
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.env.REACH_API_URL || 'https://reach.capstonesoftware.co.uk').replace(/\/$/, '');
const token = process.env.REACH_API_TOKEN;
const launch = process.argv.includes('--launch');

if (!token) {
  console.error('Set REACH_API_TOKEN (log into Reach → copy reach_token cookie or Bearer JWT)');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 400) };
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const csv = fs.readFileSync(path.join(__dirname, '../sales/accountant-leads-starter.csv'), 'utf8');

console.log('Importing accountant leads...');
const imported = await api('POST', '/api/leads/import', {
  csv,
  listName: 'TradeTap — UK Accountants (starter)',
  mapping: { email: 'email', firstName: 'firstName', lastName: 'lastName', company: 'company', title: 'title', website: 'website' },
  verify: true,
});
console.log('Import:', imported);
const listId = imported.listId;
if (!listId) {
  console.error('Import did not return listId');
  process.exit(1);
}

const campaigns = await api('GET', '/api/campaigns');
const campaign = campaigns.find((c) => c.name?.includes('TradeTap'));
if (!campaign) {
  console.error('TradeTap campaign not found — run: cd projects/reach && node server/scripts/seed-tradetap.mjs');
  process.exit(1);
}
console.log(`Campaign: ${campaign.name} (${campaign.id})`);

const leads = await api('GET', `/api/leads?listId=${encodeURIComponent(listId)}&take=100`);
const leadIds = (Array.isArray(leads) ? leads : leads.items || []).map((l) => l.id).filter(Boolean);

if (leadIds.length === 0) {
  console.log('No lead IDs returned — check import report for listId');
  process.exit(1);
}

console.log(`Enrolling ${leadIds.length} leads...`);
const enrolled = await api('POST', `/api/campaigns/${campaign.id}/enroll`, { leadIds });
console.log('Enrolled:', enrolled);

if (launch) {
  console.log('Launching campaign (requires mailboxes + DNS preflight)...');
  const result = await api('POST', `/api/campaigns/${campaign.id}/launch`, { leadIds });
  console.log('Launch:', result);
} else {
  console.log('\nDry run complete. To launch: re-run with --launch after attaching mailboxes in Reach UI.');
}