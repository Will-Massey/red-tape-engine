/**
 * Policy engine unit tests — no DB required.
 * Run: npx tsx packages/agilepilot/scripts/policy.test.mts
 */
import { evaluatePolicies, defaultEvPolicies } from '../src/policy.js';
import type { CheapSlot } from '@rte/core';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const slots: CheapSlot[] = [
  {
    start: '2026-07-16T02:00:00.000Z', // ~03:00 BST overnight
    end: '2026-07-16T02:30:00.000Z',
    pricePencePerKwh: 4,
    recommendation: 'charge',
  },
  {
    start: '2026-07-16T16:30:00.000Z', // evening peak UK
    end: '2026-07-16T17:00:00.000Z',
    pricePencePerKwh: 5,
    recommendation: 'maybe',
  },
  {
    start: '2026-07-16T12:00:00.000Z',
    end: '2026-07-16T12:30:00.000Z',
    pricePencePerKwh: 22,
    recommendation: 'avoid',
  },
];

const plan = evaluatePolicies(slots, defaultEvPolicies());

assert(plan.recommended.length >= 1, 'expected at least one recommended slot');
assert(
  plan.recommended[0].pricePencePerKwh <= 10,
  'top recommendation should prefer cheap overnight over peak',
);
assert(plan.policiesApplied.length === 3, 'default policies applied');

const carbon = new Map<string, number>([
  [slots[0].start, 80],
  [slots[1].start, 200],
  [slots[2].start, 250],
]);

const green = evaluatePolicies(
  slots,
  [
    {
      name: 'Green',
      kind: 'green_prefer',
      enabled: true,
      params: { maxGCo2PerKwh: 100 },
    },
  ],
  carbon,
);

assert(green.recommended.some((s) => s.start === slots[0].start), 'green prefer overnight low carbon');

console.log('policy.test.mts OK');
console.log('  top:', plan.recommended[0].start, plan.recommended[0].pricePencePerKwh + 'p');
console.log('  summary:', plan.summary);
