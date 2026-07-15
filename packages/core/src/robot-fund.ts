import { db, schema } from './db/client.js';
import { stripe } from './stripe.js';
import type { Vertical } from './types.js';

function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true' || !process.env.STRIPE_SECRET_KEY;
}

export const ROBOT_TARGET_GBP = Number(process.env.ROBOT_TARGET_GBP ?? 12_000);

export const VERTICAL_MRR_GBP: Record<Vertical, number> = {
  tradetap: 99,
  complybot: 19,
  planningpulse: 49,
  agilepilot: 9.99,
  housesignal: 199,
};

const PIPELINE_WEIGHT_GBP: Record<string, number> = {
  customer: 99,
  trial: 79,
  meeting: 40,
  interested: 15,
  replied: 5,
};

export interface RobotFundSource {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface RobotFundSnapshot {
  targetGbp: number;
  confirmedMrrGbp: number;
  pipelineMrrGbp: number;
  totalMrrGbp: number;
  progressPct: number;
  monthsToRobot: number | null;
  pledge: string;
  updatedAt: string;
  sources: {
    rte: RobotFundSource;
    stripe: RobotFundSource;
    reach: RobotFundSource;
    callforge: RobotFundSource;
  };
}

async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 8_000,
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, data, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

function capstoneAuthHeaders(): Record<string, string> | null {
  const secret = process.env.CAPSTONE_WEBHOOK_SECRET;
  if (!secret) return null;
  return { Authorization: `Bearer ${secret}` };
}

async function getRteMrr(): Promise<RobotFundSource> {
  const tenants = await db.select().from(schema.tenants);
  const paying = tenants.filter((t) => Boolean(t.stripeSubscriptionId));
  const potential = tenants.reduce((sum, t) => {
    const price = VERTICAL_MRR_GBP[t.vertical as Vertical] ?? 0;
    return sum + price;
  }, 0);
  const confirmed = paying.reduce((sum, t) => {
    const price = VERTICAL_MRR_GBP[t.vertical as Vertical] ?? 0;
    return sum + price;
  }, 0);

  return {
    ok: true,
    tenantCount: tenants.length,
    payingTenants: paying.length,
    confirmedMrrGbp: Math.round(confirmed * 100) / 100,
    potentialMrrGbp: Math.round(potential * 100) / 100,
    byVertical: tenants.reduce(
      (acc, t) => {
        acc[t.vertical] = (acc[t.vertical] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}

async function getStripeMrr(): Promise<RobotFundSource> {
  if (!stripe || isDemoMode()) {
    return { ok: false, connected: false, mrrGbp: 0, activeSubscriptions: 0, error: 'Stripe not configured' };
  }

  try {
    const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 });
    let mrrPence = 0;
    for (const sub of subs.data) {
      for (const item of sub.items.data) {
        const unit = item.price.unit_amount ?? 0;
        const qty = item.quantity ?? 1;
        const interval = item.price.recurring?.interval;
        if (interval === 'year') {
          mrrPence += Math.round((unit * qty) / 12);
        } else {
          mrrPence += unit * qty;
        }
      }
    }
    const mrrGbp = Math.round((mrrPence / 100) * 100) / 100;
    return {
      ok: true,
      connected: true,
      mrrGbp,
      activeSubscriptions: subs.data.length,
    };
  } catch (err) {
    return { ok: false, connected: true, mrrGbp: 0, activeSubscriptions: 0, error: (err as Error).message };
  }
}

async function getReachStats(): Promise<RobotFundSource> {
  const base = (process.env.REACH_URL ?? 'https://reach.capstonesoftware.co.uk').replace(/\/$/, '');
  const headers = capstoneAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'CAPSTONE_WEBHOOK_SECRET not set' };
  }

  const res = await fetchJson(`${base}/api/webhooks/command-stats`, { headers });
  if (!res.ok) {
    return { ok: false, error: res.error ?? 'Reach unreachable', status: res.status };
  }

  const data = res.data as Record<string, unknown>;
  return { ok: true, ...data };
}

async function getCallForgeStats(): Promise<RobotFundSource> {
  const base = (process.env.CALLFORGE_URL ?? 'https://callforge-ruau.onrender.com').replace(/\/$/, '');
  const headers = capstoneAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'CAPSTONE_WEBHOOK_SECRET not set' };
  }

  const res = await fetchJson(`${base}/api/command/robot-fund`, { headers });
  if (!res.ok) {
    return { ok: false, error: res.error ?? 'CallForge unreachable', status: res.status };
  }

  const data = res.data as Record<string, unknown>;
  return { ok: true, ...data };
}

function pipelineMrrFromReach(reach: RobotFundSource): number {
  if (!reach.ok) return 0;
  const pipeline = (reach.pipeline as Record<string, number>) ?? {};
  return Object.entries(PIPELINE_WEIGHT_GBP).reduce((sum, [stage, weight]) => {
    return sum + (pipeline[stage] ?? 0) * weight;
  }, 0);
}

export async function getRobotFundSnapshot(): Promise<RobotFundSnapshot> {
  const [rte, stripeStats, reach, callforge] = await Promise.all([
    getRteMrr(),
    getStripeMrr(),
    getReachStats(),
    getCallForgeStats(),
  ]);

  const stripeMrr = stripeStats.ok ? (stripeStats.mrrGbp as number) : 0;
  const rteConfirmed = (rte.confirmedMrrGbp as number) ?? 0;
  const confirmedMrrGbp = Math.max(stripeMrr, rteConfirmed);

  const reachPipeline = pipelineMrrFromReach(reach);
  const rtePotential = (rte.potentialMrrGbp as number) ?? 0;
  let pipelineMrrGbp = reachPipeline;
  if (!reach.ok && isDemoMode()) {
    pipelineMrrGbp = rtePotential;
  }

  const totalMrrGbp = Math.round((confirmedMrrGbp + pipelineMrrGbp) * 100) / 100;
  const progressPct = Math.min(100, Math.round((totalMrrGbp / ROBOT_TARGET_GBP) * 1000) / 10);
  const monthsToRobot =
    confirmedMrrGbp > 0 ? Math.ceil(ROBOT_TARGET_GBP / confirmedMrrGbp) : null;

  return {
    targetGbp: ROBOT_TARGET_GBP,
    confirmedMrrGbp,
    pipelineMrrGbp: Math.round(pipelineMrrGbp * 100) / 100,
    totalMrrGbp,
    progressPct,
    monthsToRobot,
    pledge: '100% of Capstone proceeds → Unitree G1 robot fund',
    updatedAt: new Date().toISOString(),
    sources: { rte, stripe: stripeStats, reach, callforge },
  };
}