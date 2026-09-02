/** Great-circle distance in miles. Same radius the legacy app used, so results match. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * A distance, worded the same way everywhere it appears.
 *
 * Precision where it changes a decision and not where it does not: half a mile
 * is a walk and 0.8 of one is too, so both read as "under a mile"; three and a
 * half miles is worth a decimal; sixty-one is not, and "61.3 mi away" only
 * looks like it was measured by a machine.
 */
export function milesLabel(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 1) return "under a mile";
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

export type LocationParts = {
  raw: string;
  clean: string;    // OX119AT
  district: string; // OX11
  area: string;     // OX
  label: string;
};

const UK_POSTCODE = /^([A-Z]{1,2})(\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})?$/i;

/** Splits "OX11 9AT", "OX11" or "Didcot" into the parts the lookup chain needs. */
export function parseLocation(input: string): LocationParts {
  const raw = (input ?? "").trim();
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = UK_POSTCODE.exec(compact);

  if (!match) {
    return { raw, clean: "", district: "", area: "", label: raw };
  }
  const [, area, districtNum, unit] = match;
  const district = `${area}${districtNum}`.toUpperCase();
  return {
    raw,
    clean: unit ? `${district}${unit}`.toUpperCase() : "",
    district,
    area: area.toUpperCase(),
    label: unit ? `${district} ${unit}`.toUpperCase() : district,
  };
}
