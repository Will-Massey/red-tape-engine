import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

import { db, schema } from './client.js';

async function main() {
  const [dave] = await db
    .insert(schema.tenants)
    .values({
      name: "Dave's Heating Ltd",
      vertical: 'tradetap',
      plan: 'pro',
      config: {
        tradeType: 'plumber',
        bookingUrl: process.env.CALCOM_BOOKING_URL ?? 'https://cal.com/demo',
        avgJobValuePence: 18500,
        // Maps the inbound Twilio number back to this tenant.
        twilioNumber: process.env.TWILIO_PHONE_NUMBER ?? '+447700900100',
      },
    })
    .returning();

  await db.insert(schema.tenants).values([
    {
      name: 'Riverside Landlords Ltd',
      vertical: 'complybot',
      plan: 'starter',
      config: { properties: 3 },
    },
    {
      name: 'Northbuild Developments',
      vertical: 'planningpulse',
      plan: 'pro',
      config: { focus: 'residential' },
    },
    {
      name: 'Agile Home UK',
      vertical: 'agilepilot',
      plan: 'starter',
      config: { hasEv: true, hasBattery: false },
    },
    {
      name: 'TalentBridge Recruiting',
      vertical: 'housesignal',
      plan: 'agency',
      config: { sicCodes: ['62012', '62020'] },
    },
  ]);

  if (dave) {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    await db.insert(schema.missedCalls).values([
      {
        tenantId: dave.id,
        callSid: 'CA_demo_001',
        fromPhone: '+447700900001',
        toPhone: '+447700900100',
        triageClassification: 'emergency',
        smsSent: "Hi, sorry we missed your call — burst pipe? Book emergency slot: https://cal.com/demo",
        recovered: 1,
        createdAt: twoDaysAgo,
      },
      {
        tenantId: dave.id,
        callSid: 'CA_demo_002',
        fromPhone: '+447700900002',
        toPhone: '+447700900100',
        triageClassification: 'quote',
        smsSent: "Thanks for calling Dave's Heating. Get a quote here: https://cal.com/demo",
        recovered: 1,
        createdAt: twoDaysAgo,
      },
      {
        tenantId: dave.id,
        callSid: 'CA_demo_003',
        fromPhone: '+447700900003',
        toPhone: '+447700900100',
        triageClassification: 'callback',
        smsSent: "We'll call you back within the hour. Or book directly: https://cal.com/demo",
        recovered: 0,
        createdAt: twoDaysAgo,
      },
    ]);

    await db.insert(schema.bookings).values([
      {
        tenantId: dave.id,
        callSid: 'CA_demo_001',
        phone: '+447700900001',
        source: 'sms_reply',
        estimatedValuePence: 28500,
        createdAt: new Date(twoDaysAgo.getTime() + 2 * 60 * 60 * 1000),
      },
      {
        tenantId: dave.id,
        callSid: 'CA_demo_002',
        phone: '+447700900002',
        source: 'sms_reply',
        estimatedValuePence: 12000,
        createdAt: new Date(twoDaysAgo.getTime() + 5 * 60 * 60 * 1000),
      },
    ]);
  }

  console.log('Seed complete — demo tenant:', dave?.name);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});