/**
 * Regression: live-mode vision failures must not fabricate MTD expenses.
 *
 *   npm run test:receipt-vision -w @rte/core
 */
import assert from 'node:assert/strict';

process.env.DEMO_MODE = 'false';
process.env.XAI_API_KEY = 'xai-invalid-on-purpose';

const { categoriseReceiptFromImage } = await import('../src/grok.js');

const buf = Buffer.from('not-a-real-image');
let threw = false;

try {
  await categoriseReceiptFromImage({
    buffer: buf,
    mimeType: 'image/jpeg',
    filename: 'crumpled-receipt.jpg',
  });
} catch {
  threw = true;
}

assert.equal(threw, true, 'categoriseReceiptFromImage must throw when vision fails in live mode');
console.log('PASS — live vision failure throws (no fabricated expense)');