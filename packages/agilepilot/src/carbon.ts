/**
 * NESO (National Energy System Operator) carbon intensity — green-shift signal.
 * Public API, no key required: https://api.carbonintensity.org.uk/
 */

export interface CarbonIntensityPoint {
  from: string;
  to: string;
  intensity: number | null;
  index: string | null;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; points: CarbonIntensityPoint[] } | null = null;

export async function fetchCarbonIntensity24h(): Promise<CarbonIntensityPoint[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.points;

  try {
    const res = await fetch('https://api.carbonintensity.org.uk/intensity', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`carbon intensity ${res.status}`);

    // Current half-hour; also pull forward forecast if available
    const nowData = (await res.json()) as {
      data?: Array<{
        from: string;
        to: string;
        intensity: { actual?: number | null; forecast?: number | null; index?: string };
      }>;
    };

    const from = new Date().toISOString();
    const forecastRes = await fetch(
      `https://api.carbonintensity.org.uk/intensity/${from}/fw24h`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      },
    );

    const points: CarbonIntensityPoint[] = [];

    if (forecastRes.ok) {
      const forecast = (await forecastRes.json()) as {
        data?: Array<{
          from: string;
          to: string;
          intensity: { actual?: number | null; forecast?: number | null; index?: string };
        }>;
      };
      for (const row of forecast.data ?? []) {
        points.push({
          from: row.from,
          to: row.to,
          intensity: row.intensity.actual ?? row.intensity.forecast ?? null,
          index: row.intensity.index ?? null,
        });
      }
    } else {
      for (const row of nowData.data ?? []) {
        points.push({
          from: row.from,
          to: row.to,
          intensity: row.intensity.actual ?? row.intensity.forecast ?? null,
          index: row.intensity.index ?? null,
        });
      }
    }

    cache = { at: Date.now(), points };
    return points;
  } catch {
    return [];
  }
}

/** Map slot start ISO → nearest carbon intensity gCO2/kWh. */
export async function carbonMapForSlots(
  slotStarts: string[],
): Promise<Map<string, number>> {
  const points = await fetchCarbonIntensity24h();
  const map = new Map<string, number>();
  if (!points.length) return map;

  for (const start of slotStarts) {
    const t = new Date(start).getTime();
    let best: CarbonIntensityPoint | null = null;
    let bestDelta = Infinity;
    for (const p of points) {
      if (p.intensity === null) continue;
      const mid =
        (new Date(p.from).getTime() + new Date(p.to).getTime()) / 2;
      const delta = Math.abs(mid - t);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = p;
      }
    }
    if (best?.intensity != null && bestDelta < 2 * 60 * 60 * 1000) {
      map.set(start, best.intensity);
    }
  }
  return map;
}
