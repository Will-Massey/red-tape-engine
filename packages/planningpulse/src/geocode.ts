const POSTCODES_API = 'https://api.postcodes.io/postcodes';

const UK_POSTCODE =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

export function extractUkPostcode(text: string): string | null {
  const match = text.match(UK_POSTCODE);
  return match ? match[1].replace(/\s+/g, ' ').trim().toUpperCase() : null;
}

/**
 * Free geocoding when the planning feed omits geometry but text carries a postcode.
 * Returns null on miss — never invents coordinates.
 */
export async function geocodeUkPostcode(
  postcode: string,
): Promise<{ lat: number; lng: number } | null> {
  const normalised = postcode.replace(/\s+/g, '').toUpperCase();
  try {
    const res = await fetch(`${POSTCODES_API}/${encodeURIComponent(normalised)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: number;
      result?: { latitude?: number; longitude?: number };
    };
    const lat = data.result?.latitude;
    const lng = data.result?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

export async function geocodeFromText(
  parts: Array<string | undefined>,
): Promise<{ lat: number; lng: number } | null> {
  const text = parts.filter((p): p is string => Boolean(p)).join(' ');
  const postcode = extractUkPostcode(text);
  if (!postcode) return null;
  return geocodeUkPostcode(postcode);
}