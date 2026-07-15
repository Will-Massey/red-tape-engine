import { schedule, validate, type ScheduledTask } from 'node-cron';
import { pollAndMatch } from './index.js';

/**
 * 6am UK, not 6am UTC: Europe/London is GMT in winter and BST in summer, so the
 * poll must be pinned to the zone rather than a fixed 24h interval, which would
 * drift by an hour at each DST boundary.
 */
export const DAILY_6AM = '0 6 * * *';
export const UK_TIMEZONE = 'Europe/London';

export interface PollerHandle {
  task: ScheduledTask;
  expression: string;
  timezone: string;
  nextRun: Date | null;
  stop: () => Promise<void>;
}

export interface PollerOptions {
  expression?: string;
  timezone?: string;
  onResult?: (result: Awaited<ReturnType<typeof pollAndMatch>>) => void;
  onError?: (error: unknown) => void;
}

export function startDailyPoller(options: PollerOptions = {}): PollerHandle {
  const expression = options.expression ?? process.env.PLANNINGPULSE_POLL_CRON ?? DAILY_6AM;
  const timezone = options.timezone ?? process.env.PLANNINGPULSE_POLL_TZ ?? UK_TIMEZONE;

  if (!validate(expression)) {
    throw new Error(`PlanningPulse: invalid cron expression "${expression}"`);
  }

  const task = schedule(
    expression,
    async () => {
      try {
        const result = await pollAndMatch();
        options.onResult?.(result);
      } catch (error) {
        // A failed poll must never take the API process down with it.
        options.onError?.(error);
      }
    },
    // A slow poll (Grok summarising every match) must not overlap the next run.
    { timezone, noOverlap: true, name: 'planningpulse-daily-poll' },
  );

  return {
    task,
    expression,
    timezone,
    nextRun: task.getNextRun(),
    stop: async () => {
      await task.stop();
      await task.destroy();
    },
  };
}
