import type { CategorisedExpense, SmsTriageResult, TriageClassification } from './types.js';

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL ?? 'grok-3-mini';
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !XAI_API_KEY;

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function chat(messages: GrokMessage[], json = false): Promise<string> {
  if (DEMO_MODE) {
    return '';
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages,
      temperature: 0.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Grok API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? '';
}

export async function triageMissedCall(input: {
  from: string;
  tradeType: string;
  businessName: string;
  bookingUrl: string;
  voicemailTranscript?: string;
}): Promise<SmsTriageResult> {
  const prompt = `You triage missed calls for UK trades businesses.
Business: ${input.businessName} (${input.tradeType})
Caller: ${input.from}
Voicemail: ${input.voicemailTranscript ?? 'No transcript — assume general enquiry'}

Return JSON only:
{
  "classification": "emergency|quote|callback|spam",
  "replyMessage": "SMS under 160 chars, British English, friendly, professional",
  "urgency": 1-5,
  "includeBookingLink": true/false
}`;

  if (DEMO_MODE) {
    return demoTriage(input);
  }

  let raw: string;
  try {
    raw = await chat(
      [
        { role: 'system', content: 'You are a UK trades SMS triage agent. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      true,
    );
  } catch {
    // A missed call must always get a text back, so fall back to the templates
    // rather than failing the webhook when xAI is unreachable or misconfigured.
    return demoTriage(input);
  }

  try {
    const parsed = JSON.parse(raw) as SmsTriageResult;
    return {
      classification: parsed.classification ?? 'callback',
      replyMessage: parsed.replyMessage ?? demoTriage(input).replyMessage,
      urgency: parsed.urgency ?? 3,
      includeBookingLink: parsed.includeBookingLink ?? true,
    };
  } catch {
    return demoTriage(input);
  }
}

function demoTriage(input: {
  businessName: string;
  bookingUrl: string;
  voicemailTranscript?: string;
}): SmsTriageResult {
  const transcript = (input.voicemailTranscript ?? '').toLowerCase();
  let classification: TriageClassification = 'callback';
  let urgency: 1 | 2 | 3 | 4 | 5 = 3;

  if (/burst|leak|emergency|no heat|flooding|gas/.test(transcript)) {
    classification = 'emergency';
    urgency = 5;
  } else if (/quote|estimate|price|boiler|install/.test(transcript)) {
    classification = 'quote';
    urgency = 2;
  } else if (/spam|ppi|accident/.test(transcript)) {
    classification = 'spam';
    urgency = 1;
  }

  const templates: Record<TriageClassification, string> = {
    emergency: `Hi — sorry we missed your call. Sounds urgent. Book emergency slot: ${input.bookingUrl}`,
    quote: `Thanks for calling ${input.businessName}. Grab a quote slot here: ${input.bookingUrl}`,
    callback: `Sorry we missed you — we're on a job. Book a callback: ${input.bookingUrl}`,
    spam: `Thanks for your message.`,
  };

  return {
    classification,
    replyMessage: templates[classification].slice(0, 160),
    urgency,
    includeBookingLink: classification !== 'spam',
  };
}

export async function categoriseReceipt(input: {
  rawText: string;
  filename: string;
}): Promise<CategorisedExpense> {
  const prompt = `Categorise this UK landlord expense receipt for MTD.
Filename: ${input.filename}
Text:
${input.rawText}

Return JSON:
{
  "vendor": string,
  "amountPence": number,
  "date": "YYYY-MM-DD",
  "category": "repairs|utilities|insurance|mortgage_interest|agent_fees|other",
  "mtdBox": "HMRC box reference",
  "confidence": 0-1
}`;

  if (DEMO_MODE) {
    return demoExpense(input.rawText);
  }

  const raw = await chat(
    [
      { role: 'system', content: 'You are a UK landlord tax categorisation agent. JSON only.' },
      { role: 'user', content: prompt },
    ],
    true,
  );

  try {
    return JSON.parse(raw) as CategorisedExpense;
  } catch {
    return demoExpense(input.rawText);
  }
}

function demoExpense(rawText: string): CategorisedExpense {
  const amountMatch = rawText.match(/£?\s*(\d+(?:\.\d{2})?)/);
  const amount = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : 4500;
  const lower = rawText.toLowerCase();

  let category: CategorisedExpense['category'] = 'other';
  let mtdBox = 'Box 20';
  if (/repair|plumb|fix/.test(lower)) {
    category = 'repairs';
    mtdBox = 'Box 29';
  } else if (/electric|gas|water|utility/.test(lower)) {
    category = 'utilities';
    mtdBox = 'Box 26';
  } else if (/insurance/.test(lower)) {
    category = 'insurance';
    mtdBox = 'Box 24';
  }

  return {
    vendor: 'Demo Vendor Ltd',
    amountPence: amount,
    date: new Date().toISOString().slice(0, 10),
    category,
    mtdBox,
    confidence: 0.85,
  };
}

export async function summarisePlanningAlert(input: {
  description: string;
  address: string;
  distanceMetres: number;
}): Promise<{ summary: string; signalScore: number }> {
  if (DEMO_MODE) {
    const score = Math.max(20, 100 - Math.floor(input.distanceMetres / 50));
    return {
      summary: `${input.description.slice(0, 80)} — ${input.distanceMetres}m from your site.`,
      signalScore: Math.min(100, score),
    };
  }

  const raw = await chat(
    [
      {
        role: 'system',
        content: 'Summarise UK planning applications for property investors. Return JSON: {summary, signalScore}',
      },
      {
        role: 'user',
        content: `Application: ${input.description}\nAddress: ${input.address}\nDistance: ${input.distanceMetres}m`,
      },
    ],
    true,
  );

  try {
    return JSON.parse(raw) as { summary: string; signalScore: number };
  } catch {
    return {
      summary: input.description.slice(0, 120),
      signalScore: 60,
    };
  }
}

export async function enrichCompanySignal(input: {
  companyName: string;
  signalType: string;
  sicCodes?: string[];
}): Promise<{ enrichment: string; score: number }> {
  if (DEMO_MODE) {
    return {
      enrichment: `${input.companyName} — ${input.signalType.replace('_', ' ')}. Likely hiring if SIC matches tech.`,
      score: 72,
    };
  }

  const raw = await chat(
    [
      { role: 'system', content: 'Enrich UK Companies House signals for B2B sales. JSON: {enrichment, score}' },
      { role: 'user', content: JSON.stringify(input) },
    ],
    true,
  );

  try {
    return JSON.parse(raw) as { enrichment: string; score: number };
  } catch {
    return { enrichment: input.companyName, score: 50 };
  }
}

export function isDemoMode(): boolean {
  return DEMO_MODE;
}