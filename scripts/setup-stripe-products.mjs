#!/usr/bin/env node
/**
 * Create Stripe subscription prices for all RTE verticals.
 * Prints env vars to paste into Render.
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.mjs
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key || key.includes('...')) {
  console.error('Set a real STRIPE_SECRET_KEY (not placeholder)');
  process.exit(1);
}

const stripe = new Stripe(key);

const verticals = [
  { slug: 'tradetap', name: 'TradeTap', amount: 9900 },
  { slug: 'complybot', name: 'ComplyBot', amount: 1900 },
  { slug: 'planningpulse', name: 'PlanningPulse', amount: 4900 },
  { slug: 'agilepilot', name: 'AgilePilot', amount: 999 },
  { slug: 'housesignal', name: 'HouseSignal', amount: 19900 },
];

const env = {};

for (const v of verticals) {
  const product = await stripe.products.create({
    name: `Red Tape Engine — ${v.name}`,
    metadata: { vertical: v.slug, product: 'red-tape-engine' },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'gbp',
    unit_amount: v.amount,
    recurring: { interval: 'month' },
    metadata: { vertical: v.slug },
  });
  const envKey = `STRIPE_PRICE_${v.slug === 'planningpulse' ? 'PLANNING' : v.slug === 'housesignal' ? 'HOUSE' : v.slug === 'agilepilot' ? 'AGILE' : v.slug.toUpperCase()}`;
  env[envKey] = price.id;
  console.log(`${v.name}: ${price.id} (£${(v.amount / 100).toFixed(2)}/mo)`);
}

console.log('\n# Paste into Render RTE env:');
for (const [k, v] of Object.entries(env)) {
  console.log(`${k}=${v}`);
}
console.log('DEMO_MODE=false');
console.log(`STRIPE_SECRET_KEY=${key.slice(0, 12)}...`);