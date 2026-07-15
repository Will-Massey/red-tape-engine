const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? 'PlanningPulse <onboarding@resend.dev>';
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !RESEND_API_KEY;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(
  message: EmailMessage,
): Promise<{ id: string; demo: boolean }> {
  if (DEMO_MODE) {
    console.log(`[DEMO EMAIL] → ${message.to}: ${message.subject}`);
    return { id: `email_demo_${Date.now()}`, demo: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { id?: string };
  return { id: data.id ?? `email_${Date.now()}`, demo: false };
}