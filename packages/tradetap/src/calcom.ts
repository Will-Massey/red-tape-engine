import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Parser for real Cal.com webhook payloads.
 * Shape: { triggerEvent, createdAt, payload: { uid, bookingId, attendees[], responses{}, ... } }
 */

export type CalTriggerEvent =
  | 'BOOKING_CREATED'
  | 'BOOKING_REQUESTED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_PAID'
  | 'MEETING_ENDED'
  | (string & {});

export interface ParsedCalBooking {
  triggerEvent: CalTriggerEvent;
  uid: string | null;
  bookingId: number | null;
  phone: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  title: string | null;
  startTime: string | null;
  /** Set when the booking link was tagged with tenant/call context. */
  tenantId: string | null;
  callSid: string | null;
}

/** Cal.com sends HMAC-SHA256 of the raw body, hex encoded, in x-cal-signature-256. */
export function verifyCalcomSignature(rawBody: string | Buffer, signature?: string): boolean {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) return true; // demo mode — nothing to verify against
  if (!signature) return false;

  const expected = createHmac('sha256', secret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8'))
    .digest('hex');

  const provided = Buffer.from(signature, 'utf-8');
  const computed = Buffer.from(expected, 'utf-8');
  if (provided.length !== computed.length) return false;

  return timingSafeEqual(provided, computed);
}

export function isCalcomSignatureRequired(): boolean {
  return Boolean(process.env.CALCOM_WEBHOOK_SECRET);
}

/** Booking fields arrive as `"+44..."` or `{ label, value }` depending on field type. */
function responseValue(responses: Record<string, unknown> | undefined, key: string): string | null {
  const field = responses?.[key];
  if (typeof field === 'string') return field.trim() || null;
  if (field && typeof field === 'object' && 'value' in field) {
    const value = (field as { value: unknown }).value;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function parseCalcomWebhook(body: unknown): ParsedCalBooking | null {
  if (!body || typeof body !== 'object') return null;

  const root = body as Record<string, unknown>;
  const payload = (root.payload ?? {}) as Record<string, unknown>;
  const triggerEvent = typeof root.triggerEvent === 'string' ? root.triggerEvent : null;
  if (!triggerEvent) return null;

  const responses = (payload.responses ?? payload.bookingFieldsResponses ?? {}) as Record<
    string,
    unknown
  >;
  const attendees = Array.isArray(payload.attendees)
    ? (payload.attendees as Array<Record<string, unknown>>)
    : [];
  const attendee = attendees[0] ?? {};
  const metadata = (payload.metadata ?? {}) as Record<string, unknown>;

  const phone = firstString(
    responseValue(responses, 'phone'),
    responseValue(responses, 'attendeePhoneNumber'),
    responseValue(responses, 'smsReminderNumber'),
    typeof attendee.phoneNumber === 'string' ? attendee.phoneNumber : null,
  );

  const rawBookingId = payload.bookingId ?? payload.id;
  const bookingId =
    typeof rawBookingId === 'number'
      ? rawBookingId
      : typeof rawBookingId === 'string' && rawBookingId.trim() !== ''
        ? Number(rawBookingId)
        : null;

  return {
    triggerEvent,
    uid: firstString(typeof payload.uid === 'string' ? payload.uid : null),
    bookingId: bookingId !== null && Number.isFinite(bookingId) ? bookingId : null,
    phone,
    attendeeName: firstString(
      typeof attendee.name === 'string' ? attendee.name : null,
      responseValue(responses, 'name'),
    ),
    attendeeEmail: firstString(
      typeof attendee.email === 'string' ? attendee.email : null,
      responseValue(responses, 'email'),
    ),
    title: firstString(typeof payload.title === 'string' ? payload.title : null),
    startTime: firstString(typeof payload.startTime === 'string' ? payload.startTime : null),
    tenantId: firstString(
      typeof metadata.tenantId === 'string' ? metadata.tenantId : null,
      responseValue(responses, 'tenantId'),
    ),
    callSid: firstString(
      typeof metadata.callSid === 'string' ? metadata.callSid : null,
      responseValue(responses, 'callSid'),
    ),
  };
}

/** Only these create a booking; the rest are acknowledged and ignored. */
export const BOOKING_CREATING_EVENTS: CalTriggerEvent[] = ['BOOKING_CREATED', 'BOOKING_PAID'];
export const BOOKING_CANCELLING_EVENTS: CalTriggerEvent[] = ['BOOKING_CANCELLED', 'BOOKING_REJECTED'];
