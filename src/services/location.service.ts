import "server-only";

import { parseLocation } from "@/utils/geo";
import centroids from "@/data/location-centroids.json";

/**
 * Turns "OX11", "OX11 9AT" or "Didcot" into coordinates.
 *
 * Mirrors the legacy resolution order so results match the existing site:
 * exact postcode among known clubs, then district, then area, then town name,
 * then the built-in centroid tables. External geocoding is a last resort and
 * almost never reached — which is why the legacy geocode cache is still empty.
 */

export type Origin = { label: string; latitude: number; longitude: number };

type ClubPoint = {
  latitude: number | null;
  longitude: number | null;
  venue_postcode: string | null;
  venue_postcode_district: string | null;
  venue_postcode_area: string | null;
  city: string;
};

const POSTCODES = centroids.postcodes as Record<string, Origin>;
const PLACES = centroids.places as Record<string, Origin>;

const compact = (value: string | null) => (value ?? "").replace(/\s+/g, "").toUpperCase();

function averageOf(points: ClubPoint[]): { latitude: number; longitude: number } {
  return {
    latitude: points.reduce((n, p) => n + (p.latitude ?? 0), 0) / points.length,
    longitude: points.reduce((n, p) => n + (p.longitude ?? 0), 0) / points.length,
  };
}

export function resolveOrigin(input: string, clubs: ClubPoint[]): Origin | null {
  const parts = parseLocation(input);
  if (!parts.raw) return null;

  const located = clubs.filter((c) => c.latitude != null && c.longitude != null);
  const lower = parts.raw.toLowerCase();

  const exact = located.filter((c) => parts.clean && compact(c.venue_postcode) === parts.clean);
  const district = located.filter((c) => parts.district && compact(c.venue_postcode_district) === parts.district);
  const town = located.filter((c) => c.city && c.city.toLowerCase() === lower);

  // A known district centroid beats averaging clubs that merely share an area.
  if (exact.length === 0 && POSTCODES[parts.district]) {
    return { ...POSTCODES[parts.district], label: parts.label || POSTCODES[parts.district].label };
  }

  /**
   * Deliberately no fallback to the postcode area. A two-letter area spans
   * fifty miles (OX runs from Banbury to Henley), so averaging the clubs inside
   * it answered every OX postcode with the same point: OX9 claimed Abingdon was
   * 3 miles away when Thame, which is OX9, is really 14. Worse, returning here
   * meant the real outcode lookup was never reached. Unknown outcodes now fall
   * through to the geocoder, which knows where they actually are.
   */
  const matches = exact.length ? exact : district.length ? district : town;
  if (matches.length) {
    return { label: parts.label || parts.raw, ...averageOf(matches) };
  }

  const byPostcode = POSTCODES[parts.clean] ?? POSTCODES[parts.district];
  if (byPostcode) return { ...byPostcode, label: parts.label || byPostcode.label };

  const place = PLACES[lower];
  if (place) return { ...place, label: parts.raw || place.label };

  return null;
}
