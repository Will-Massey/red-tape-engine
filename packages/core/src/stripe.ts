import Stripe from 'stripe';
import { db, schema } from './db/client.js';
import { eq } from 'drizzle-orm';
import type { Vertical } from './types.js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !stripeKey;

export const stripe = stripeKey ? new Stripe(stripeKey) : null;

const PRICE_MAP: Record<Vertical, string | undefined> = {
  tradetap: process.env.STRIPE_PRICE_TRADETAP,
  complybot: process.env.STRIPE_PRICE_COMPLYBOT,
  planningpulse: process.env.STRIPE_PRICE_PLANNING,
  agilepilot: process.env.STRIPE_PRICE_AGILE,
  housesignal: process.env.STRIPE_PRICE_HOUSE,
};

export async function createCheckoutSession(input: {
  tenantId: string;
  vertical: Vertical;
  customerEmail?: string;
}): Promise<{ url: string; demo: boolean }> {
  const priceId = PRICE_MAP[input.vertical];
  const appUrl = process.env.APP_URL ?? 'http://localhost:3847';

  if (DEMO_MODE || !stripe || !priceId) {
    return {
      url: `${appUrl}/demo/checkout?vertical=${input.vertical}&tenant=${input.tenantId}`,
      demo: true,
    };
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant not found: ${input.tenantId}`);
  }

  const metadata = { tenantId: input.tenantId, vertical: input.vertical };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/dashboard?cancelled=1`,
    client_reference_id: input.tenantId,
    metadata,
    // Carried onto the subscription so later lifecycle events resolve the tenant.
    subscription_data: { metadata },
    // Reuse the existing customer so repeat checkouts don't duplicate records.
    ...(tenant.stripeCustomerId
      ? { customer: tenant.stripeCustomerId }
      : { customer_email: input.customerEmail }),
  });

  return { url: session.url ?? appUrl, demo: false };
}

export async function handleStripeWebhook(
  payload: string | Buffer,
  signature: string,
): Promise<{ handled: boolean; message: string }> {
  if (!stripe || DEMO_MODE) {
    return { handled: true, message: 'Demo mode — webhook acknowledged' };
  }

  // Live Stripe key but no signing secret would mean accepting unverified
  // events that can flip a tenant's plan. Refuse instead.
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured — refusing unverified webhook');
  }

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const tenantId = session.metadata?.tenantId ?? session.client_reference_id ?? undefined;
    if (!tenantId) {
      return { handled: false, message: 'checkout.session.completed without tenantId' };
    }

    await db
      .update(schema.tenants)
      .set({
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        plan: 'starter',
      })
      .where(eq(schema.tenants.id, tenantId));

    return { handled: true, message: `Checkout completed for tenant ${tenantId}` };
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) {
      return { handled: false, message: 'subscription.deleted without tenantId' };
    }

    await db
      .update(schema.tenants)
      .set({ plan: 'trial', stripeSubscriptionId: null })
      .where(eq(schema.tenants.id, tenantId));

    return { handled: true, message: `Subscription cancelled for tenant ${tenantId}` };
  }

  return { handled: true, message: `Unhandled event: ${event.type}` };
}