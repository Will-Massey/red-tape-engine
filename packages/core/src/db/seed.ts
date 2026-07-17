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

  const others = await db
    .insert(schema.tenants)
    .values([
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
      config: {
        focus: 'residential',
        digestEmail: process.env.PLANNINGPULSE_DIGEST_EMAIL ?? 'alerts@northbuild.example',
      },
    },
    {
      name: 'Agile Home UK',
      vertical: 'agilepilot',
      plan: 'starter',
      config: {
        hasEv: true,
        hasBattery: false,
        provider: 'octopus',
        region: 'C',
      },
    },
    {
      name: 'TalentBridge Recruiting',
      vertical: 'housesignal',
      plan: 'agency',
      config: { sicCodes: ['62012', '62020'] },
    },
  ])
    .returning();

  const northbuild = others.find((t) => t.vertical === 'planningpulse');
  if (northbuild) {
    await db.insert(schema.planningSubscriptions).values({
      tenantId: northbuild.id,
      name: 'Oxford Road site',
      lat: 53.466,
      lng: -2.242,
      radiusMetres: 5000,
    });
  }

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

  const agileTenant = others.find((t) => t.vertical === 'agilepilot');
  if (agileTenant) {
    await db.insert(schema.loadShiftPolicies).values([
      {
        tenantId: agileTenant.id,
        name: 'EV ready by 07:00',
        kind: 'ev_ready_by',
        enabled: 1,
        params: { deadlineHour: 7, chargeHours: 4 },
      },
      {
        tenantId: agileTenant.id,
        name: 'Avoid evening peak',
        kind: 'peak_avoid',
        enabled: 1,
        params: { peakStartHour: 16, peakEndHour: 19 },
      },
      {
        tenantId: agileTenant.id,
        name: 'Prefer greener half-hours',
        kind: 'green_prefer',
        enabled: 1,
        params: { maxGCo2PerKwh: 150 },
      },
    ]);

    const [partner] = await db
      .insert(schema.loadShiftPartners)
      .values({
        name: 'Demo Energy Partner',
        slug: 'demo-energy',
        apiKey: `lsp_demo_${Buffer.from('capstone-demo-partner').toString('hex')}`,
        brand: {
          productName: 'SmartShift',
          primaryColor: '#00d4aa',
          supportEmail: 'support@demo-energy.example',
        },
        config: { defaultProvider: 'octopus', enterpriseMode: true },
        active: 1,
      })
      .returning();

    console.log('AgilePilot partner seed:', partner?.slug, 'apiKey:', partner?.apiKey);
  }

  console.log('Seed complete — demo tenant:', dave?.name);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});