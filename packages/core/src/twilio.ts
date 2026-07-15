import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !accountSid || !authToken;

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!client && accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string; demo: boolean }> {
  if (DEMO_MODE) {
    console.log(`[DEMO SMS] → ${to}: ${body}`);
    return { sid: `SM_demo_${Date.now()}`, demo: true };
  }

  const tw = getClient();
  if (!tw || !fromNumber) {
    throw new Error('Twilio not configured');
  }

  const msg = await tw.messages.create({ to, from: fromNumber, body });
  return { sid: msg.sid, demo: false };
}

export function twimlMissedCall(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Sorry we're on a job right now. We'll text you back in a few seconds.</Say>
  <Hangup/>
</Response>`;
}