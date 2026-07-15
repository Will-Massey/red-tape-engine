import { and, eq, inArray } from 'drizzle-orm';
import { db, schema, summarisePlanningAlert, logUsage, isDemoMode } from '@rte/core';
import type { PlanningApplication } from '@rte/core';
import { sendPlanningDigest, type DigestResult } from './digest.js';

type AlertRow = typeof schema.planningAlerts.$inferSelect;

const PLANNING_API = 'https://www.planning.data.gov.uk/entity.json';

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Reads a real location from an entity, or null if it has none.
 *
 * Every alert claims a distance from the subscriber's site, so a made-up
 * coordinate is a made-up distance. An application whose location we cannot
 * establish is dropped rather than placed somewhere plausible.
 */
function locationOf(e: Record<string, unknown>): { lat: number; lng: number } | null {
  const point = typeof e.point === 'string' ? e.point : '';
  const wkt = point.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (wkt) {
    const lng = Number(wkt[1]);
    const lat = Number(wkt[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const lat = Number(e.latitude ?? e.lat);
  const lng = Number(e.longitude ?? e.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }

  return null;
}

async function fetchRecentApplications(): Promise<PlanningApplication[]> {
  try {
    const url = `${PLANNING_API}?dataset=planning-application&limit=20`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Planning API ${res.status}`);
    const data = (await res.json()) as {
      entities?: Array<Record<string, unknown>>;
    };

    const entities = data.entities ?? [];
    const located: PlanningApplication[] = [];

    for (const [i, e] of entities.entries()) {
      const location = locationOf(e);
      if (!location) continue;

      located.push({
        reference: String(e.reference ?? e['reference-number'] ?? `APP-${i}`),
        lpa: String(e.organisation ?? e['planning-decision-making-body'] ?? 'Unknown LPA'),
        description: String(e.description ?? e.name ?? 'Planning application'),
        address: String(e.address ?? e['site-address'] ?? 'UK'),
        lat: location.lat,
        lng: location.lng,
        status: String(e['decision-date'] ?? e.status ?? 'submitted'),
        receivedAt: String(e['entry-date'] ?? new Date().toISOString()),
      });
    }

    if (located.length < entities.length) {
      console.warn(
        `PlanningPulse: ${entities.length - located.length}/${entities.length} applications ` +
          'had no location and were skipped — proximity cannot be computed for them.',
      );
    }

    // Demo mode still needs something to match against; live mode must not
    // invent applications that nobody filed.
    if (!located.length && isDemoMode()) return demoApplications();

    return located;
  } catch (err) {
    if (!isDemoMode()) throw err;
    return demoApplications();
  }
}

function demoApplications(): PlanningApplication[] {
  return [
    {
      reference: '24/01234/FUL',
      lpa: 'Manchester City Council',
      description: 'Erection of 3-storey residential building with 12 flats',
      address: 'Oxford Road, Manchester M1',
      lat: 53.466,
      lng: -2.242,
      status: 'approved',
      receivedAt: new Date().toISOString(),
    },
    {
      reference: '24/00987/REM',
      lpa: 'Birmingham City Council',
      description: 'Change of use to HMO — 6 bedrooms',
      address: 'Edgbaston, Birmingham B15',
      lat: 52.453,
      lng: -1.924,
      status: 'pending',
      receivedAt: new Date().toISOString(),
    },
    {
      reference: '24/00555/COM',
      lpa: 'Leeds City Council',
      description: 'New commercial unit — 450sqm retail',
      address: 'Headingley, Leeds LS6',
      lat: 53.826,
      lng: -1.582,
      status: 'submitted',
      receivedAt: new Date().toISOString(),
    },
  ];
}

export async function createSubscription(input: {
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  radiusMetres?: number;
}) {
  const [sub] = await db
    .insert(schema.planningSubscriptions)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      radiusMetres: input.radiusMetres ?? 1500,
    })
    .returning();

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'planningpulse',
    action: 'subscription_created',
    metadata: { name: input.name, lat: input.lat, lng: input.lng },
  });

  return sub;
}

/**
 * References already alerted for these tenants, so a repeated poll (the daily
 * cron re-reads the same open applications) does not re-alert or re-email them.
 */
async function alreadyAlerted(
  tenantIds: string[],
  references: string[],
): Promise<Set<string>> {
  if (!tenantIds.length || !references.length) return new Set();

  const rows = await db
    .select({
      tenantId: schema.planningAlerts.tenantId,
      reference: schema.planningAlerts.reference,
    })
    .from(schema.planningAlerts)
    .where(
      and(
        inArray(schema.planningAlerts.tenantId, tenantIds),
        inArray(schema.planningAlerts.reference, references),
      ),
    );

  return new Set(rows.map((r) => `${r.tenantId}:${r.reference}`));
}

export async function pollAndMatch(tenantId?: string) {
  const applications = await fetchRecentApplications();
  const subs = tenantId
    ? await db
        .select()
        .from(schema.planningSubscriptions)
        .where(eq(schema.planningSubscriptions.tenantId, tenantId))
    : await db.select().from(schema.planningSubscriptions);

  const seen = await alreadyAlerted(
    [...new Set(subs.map((s) => s.tenantId))],
    applications.map((a) => a.reference),
  );

  const byTenant = new Map<string, AlertRow[]>();
  const alerts: AlertRow[] = [];

  for (const sub of subs) {
    for (const app of applications) {
      const key = `${sub.tenantId}:${app.reference}`;
      if (seen.has(key)) continue;

      const distance = Math.round(haversineMetres(sub.lat, sub.lng, app.lat, app.lng));
      if (distance > sub.radiusMetres) continue;

      seen.add(key);

      const { summary, signalScore } = await summarisePlanningAlert({
        description: app.description,
        address: app.address,
        distanceMetres: distance,
      });

      const [alert] = await db
        .insert(schema.planningAlerts)
        .values({
          tenantId: sub.tenantId,
          reference: app.reference,
          lpa: app.lpa,
          description: app.description,
          address: app.address,
          lat: app.lat,
          lng: app.lng,
          status: app.status,
          distanceMetres: distance,
          signalScore,
          summary,
          receivedAt: new Date(app.receivedAt),
        })
        .returning();

      alerts.push(alert);
      byTenant.set(sub.tenantId, [...(byTenant.get(sub.tenantId) ?? []), alert]);

      await logUsage({
        tenantId: sub.tenantId,
        vertical: 'planningpulse',
        action: 'alert_generated',
        metadata: { reference: app.reference, distance, signalScore },
      });
    }
  }

  const digests: DigestResult[] = [];
  for (const [id, tenantAlerts] of byTenant) {
    const digest = await sendPlanningDigest({ tenantId: id, alerts: tenantAlerts });
    digests.push(digest);

    if (digest.sent) {
      await logUsage({
        tenantId: id,
        vertical: 'planningpulse',
        action: 'digest_sent',
        metadata: { alertCount: digest.alertCount, recipient: digest.recipient },
      });
    }
  }

  return {
    polled: applications.length,
    alertsGenerated: alerts.length,
    alerts,
    digests,
  };
}

export async function getAlerts(tenantId: string) {
  return db
    .select()
    .from(schema.planningAlerts)
    .where(eq(schema.planningAlerts.tenantId, tenantId));
}

export { renderPlanningDigest, sendPlanningDigest } from './digest.js';
export type { PlanningDigest, DigestResult, DigestSkipReason } from './digest.js';