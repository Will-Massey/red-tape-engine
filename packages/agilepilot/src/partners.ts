import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@rte/core';
import { getPartnerLedgerAggregate } from './ledger.js';

export interface PartnerBrand {
  logoUrl?: string;
  primaryColor?: string;
  productName?: string;
  supportEmail?: string;
  domain?: string;
}

export interface CreatePartnerInput {
  name: string;
  slug: string;
  brand?: PartnerBrand;
  config?: Record<string, unknown>;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function createPartner(input: CreatePartnerInput) {
  const slug = input.slug || slugify(input.name);
  const apiKey = `lsp_${randomBytes(24).toString('hex')}`;

  const [partner] = await db
    .insert(schema.loadShiftPartners)
    .values({
      name: input.name,
      slug,
      apiKey,
      brand: input.brand ?? {},
      config: input.config ?? { defaultProvider: 'octopus', enterpriseMode: true },
      active: 1,
    })
    .returning();

  return partner;
}

export async function getPartnerByApiKey(apiKey: string) {
  if (!apiKey) return null;
  const [partner] = await db
    .select()
    .from(schema.loadShiftPartners)
    .where(eq(schema.loadShiftPartners.apiKey, apiKey))
    .limit(1);
  if (!partner || partner.active !== 1) return null;
  return partner;
}

export async function getPartnerBySlug(slug: string) {
  const [partner] = await db
    .select()
    .from(schema.loadShiftPartners)
    .where(eq(schema.loadShiftPartners.slug, slug))
    .limit(1);
  return partner ?? null;
}

export async function listPartners() {
  return db.select().from(schema.loadShiftPartners);
}

/** Public brand config for white-label UI (never includes apiKey). */
export function publicBrand(partner: typeof schema.loadShiftPartners.$inferSelect) {
  const brand = (partner.brand ?? {}) as PartnerBrand;
  return {
    slug: partner.slug,
    name: partner.name,
    productName: brand.productName || partner.name,
    logoUrl: brand.logoUrl ?? null,
    primaryColor: brand.primaryColor ?? '#00d4aa',
    supportEmail: brand.supportEmail ?? null,
    domain: brand.domain ?? null,
  };
}

export async function partnerDashboard(partnerId: string) {
  const [partner] = await db
    .select()
    .from(schema.loadShiftPartners)
    .where(eq(schema.loadShiftPartners.id, partnerId))
    .limit(1);
  if (!partner) return null;

  const savings = await getPartnerLedgerAggregate(partnerId, 30);

  return {
    partner: publicBrand(partner),
    config: partner.config,
    savings30d: savings,
  };
}
