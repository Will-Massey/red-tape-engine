import { categoriseReceiptFromImage, isDemoMode } from '@rte/core';
import { db, schema, logUsage } from '@rte/core';

export interface ReceiptUpload {
  tenantId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const TEXT_MIME = new Set(['text/plain', 'text/csv']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);

export class ReceiptRejected extends Error {
  readonly statusCode: number;
  readonly reason: string;

  constructor(statusCode: number, reason: string, message: string) {
    super(message);
    this.name = 'ReceiptRejected';
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

function normaliseMime(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

export function isSupportedReceiptMime(mimeType: string): boolean {
  const mime = normaliseMime(mimeType);
  return TEXT_MIME.has(mime) || IMAGE_MIME.has(mime);
}

function extractText(buffer: Buffer, mimeType: string): string | null {
  return TEXT_MIME.has(normaliseMime(mimeType)) ? buffer.toString('utf8') : null;
}

async function categoriseImageUpload(input: ReceiptUpload) {
  const mime = normaliseMime(input.mimeType);
  const categorised = await categoriseReceiptFromImage({
    buffer: input.buffer,
    mimeType: mime,
    filename: input.filename,
  });

  const [expense] = await db
    .insert(schema.expenses)
    .values({
      tenantId: input.tenantId,
      vendor: categorised.vendor,
      amountPence: categorised.amountPence,
      date: categorised.date,
      category: categorised.category,
      mtdBox: categorised.mtdBox,
      confidence: categorised.confidence,
      rawText: `Image: ${input.filename}`,
    })
    .returning();

  await logUsage({
    tenantId: input.tenantId,
    vertical: 'complybot',
    action: 'receipt_categorised',
    metadata: { category: categorised.category, amountPence: categorised.amountPence, source: 'image' },
  });

  return { expense, categorised };
}

export async function processReceiptUpload(input: ReceiptUpload) {
  const mime = normaliseMime(input.mimeType);

  if (!isSupportedReceiptMime(mime)) {
    throw new ReceiptRejected(
      415,
      'unsupported_media_type',
      `Unsupported receipt type "${mime}". Accepts: ${[...TEXT_MIME, ...IMAGE_MIME].join(', ')}.`,
    );
  }

  if (input.buffer.length === 0) {
    throw new ReceiptRejected(400, 'empty_file', 'Receipt file is empty.');
  }

  if (input.buffer.length > MAX_RECEIPT_BYTES) {
    throw new ReceiptRejected(
      413,
      'file_too_large',
      `Receipt exceeds ${MAX_RECEIPT_BYTES / 1024 / 1024}MB.`,
    );
  }

  const rawText = extractText(input.buffer, mime);

  if (rawText === null) {
    try {
      const result = await categoriseImageUpload(input);
      return {
        ...result,
        upload: {
          filename: input.filename,
          mimeType: mime,
          bytes: input.buffer.length,
          textSource: isDemoMode() ? ('demo_stub' as const) : ('vision' as const),
        },
      };
    } catch {
      throw new ReceiptRejected(
        502,
        'receipt_unreadable',
        'Could not read receipt image. Please re-shoot the photo with better lighting.',
      );
    }
  }

  const { processReceipt } = await import('./index.js');
  const result = await processReceipt({
    tenantId: input.tenantId,
    filename: input.filename,
    rawText,
  });

  return {
    ...result,
    upload: {
      filename: input.filename,
      mimeType: mime,
      bytes: input.buffer.length,
      textSource: 'decoded' as const,
    },
  };
}
