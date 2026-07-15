import { eq } from 'drizzle-orm';
import { db, schema } from '@rte/core';

type AlertRow = typeof schema.planningAlerts.$inferSelect;

export interface PlanningDigest {
  subject: string;
  html: string;
  text: string;
}

export type DigestSkipReason =
  | 'no_alerts'
  | 'no_recipient'
  | 'tenant_not_found'
  | 'core_send_unavailable';

export interface DigestResult {
  tenantId: string;
  sent: boolean;
  recipient?: string;
  alertCount: number;
  reason?: DigestSkipReason;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type CoreSendEmail = (msg: EmailMessage) => Promise<unknown>;

/**
 * sendEmail lands in @rte/core (owned by the conductor) and is not there yet.
 * Resolved at call time so PlanningPulse keeps working before it exists —
 * and picks it up with no change here once it does. Shared rule #2 forbids a
 * second Resend client, so there is deliberately no local fallback sender.
 */
async function resolveCoreSendEmail(): Promise<CoreSendEmail | null> {
  const core = (await import('@rte/core')) as unknown as Record<string, unknown>;
  const fn = core.sendEmail;
  return typeof fn === 'function' ? (fn as CoreSendEmail) : null;
}

function digestEmailOf(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const value = (config as Record<string, unknown>).digestEmail;
  return typeof value === 'string' && value.includes('@') ? value : null;
}

function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)}km` : `${metres}m`;
}

function formatReceived(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPlanningDigest(input: {
  tenantName: string;
  alerts: AlertRow[];
}): PlanningDigest {
  const alerts = [...input.alerts].sort((a, b) => b.signalScore - a.signalScore);
  const top = alerts[0];
  const plural = alerts.length === 1 ? 'application' : 'applications';

  const subject =
    alerts.length === 1
      ? `PlanningPulse: 1 new application near ${input.tenantName}`
      : `PlanningPulse: ${alerts.length} new ${plural} near ${input.tenantName}` +
        (top ? ` (top signal ${top.signalScore}/100)` : '');

  const text = [
    `${alerts.length} new planning ${plural} matched your watch areas.`,
    '',
    ...alerts.map((a) =>
      [
        `${a.reference} — signal ${a.signalScore}/100`,
        `${a.description}`,
        `${a.address} — ${formatDistance(a.distanceMetres)} away`,
        `${a.lpa} — status ${a.status} — received ${formatReceived(a.receivedAt)}`,
        `${a.summary}`,
      ].join('\n'),
    ),
    '',
    'Sent by PlanningPulse — Red Tape Engine.',
  ].join('\n\n');

  const rows = alerts
    .map(
      (a) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
          <div style="font:600 15px system-ui,sans-serif;color:#111827;">
            ${escapeHtml(a.reference)}
            <span style="font-weight:400;color:#6b7280;">— signal ${a.signalScore}/100</span>
          </div>
          <div style="font:400 14px system-ui,sans-serif;color:#374151;margin-top:4px;">
            ${escapeHtml(a.description)}
          </div>
          <div style="font:400 13px system-ui,sans-serif;color:#6b7280;margin-top:4px;">
            ${escapeHtml(a.address)} — ${formatDistance(a.distanceMetres)} away — ${escapeHtml(a.lpa)}
          </div>
          <div style="font:400 13px system-ui,sans-serif;color:#6b7280;margin-top:4px;">
            Status ${escapeHtml(a.status)} — received ${formatReceived(a.receivedAt)}
          </div>
          <div style="font:400 13px system-ui,sans-serif;color:#111827;margin-top:6px;">
            ${escapeHtml(a.summary)}
          </div>
        </td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f9fafb;">
  <table role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
    <tr><td>
      <div style="font:700 18px system-ui,sans-serif;color:#111827;">
        ${alerts.length} new planning ${plural}
      </div>
      <div style="font:400 14px system-ui,sans-serif;color:#6b7280;margin-top:4px;">
        Matched your watch areas for ${escapeHtml(input.tenantName)}.
      </div>
    </td></tr>
    ${rows}
    <tr><td style="padding-top:16px;font:400 12px system-ui,sans-serif;color:#9ca3af;">
      Sent by PlanningPulse — Red Tape Engine.
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

export async function sendPlanningDigest(input: {
  tenantId: string;
  alerts: AlertRow[];
}): Promise<DigestResult> {
  const base = { tenantId: input.tenantId, alertCount: input.alerts.length };

  if (input.alerts.length === 0) {
    return { ...base, sent: false, reason: 'no_alerts' };
  }

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) return { ...base, sent: false, reason: 'tenant_not_found' };

  const recipient = digestEmailOf(tenant.config);
  if (!recipient) return { ...base, sent: false, reason: 'no_recipient' };

  const send = await resolveCoreSendEmail();
  if (!send) {
    return { ...base, sent: false, recipient, reason: 'core_send_unavailable' };
  }

  const digest = renderPlanningDigest({ tenantName: tenant.name, alerts: input.alerts });
  await send({ to: recipient, ...digest });

  return { ...base, sent: true, recipient };
}
