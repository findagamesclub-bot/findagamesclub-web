import "server-only";

import { parseLocation } from "@/utils/geo";
import type { Origin } from "./location.service";

/**
 * Fallback lookup for places the built-in table doesn't know.
 *
 * The centroid table carries ten towns, all in Oxfordshire and Berkshire,
 * because that is what the legacy app shipped. Anything else fell through and
 * the search quietly returned every club with no distance filter at all, so a
 * search near Yorkshire listed one in Glasgow.
 *
 * postcodes.io is free, UK-only and needs no key. It is a fallback, not a
 * dependency: if it is slow or down, the caller treats the place as unknown and
 * says so, rather than pretending the location was applied.
 */

const BASE = "https://api.postcodes.io";
const TIMEOUT_MS = 2500;

/** Survives the request, so a repeated search doesn't hit the network twice. */
const cache = new Map<string, Origin | null>();

type Fetched = { reachable: boolean; data: unknown };

async function getJson(url: string): Promise<Fetched> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Places don't move. A long cache also keeps us well inside fair use.
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    // 404 is a real answer: that place does not exist. 5xx is not.
    if (response.status === 404) return { reachable: true, data: null };
    if (!response.ok) return { reachable: false, data: null };
    return { reachable: true, data: await response.json() };
  } catch {
    // Timeout, DNS failure, offline.
    return { reachable: false, data: null };
  }
}

type Point = { latitude?: number; longitude?: number };

/**
 * Too small to be what anyone meant by name. Suffolk has a hamlet called
 * Dublin, so searching for the Irish capital measured from there instead of
 * saying we could not find it. A postcode still reaches these places exactly.
 *
 * Only hamlets. An earlier version ranked candidates by `local_type` to pick
 * the "biggest" namesake, which was wrong: that field is the form of the
 * settlement, not its importance, so large urban places are often typed
 * "Other Settlement" while tiny rural ones are "Village". Ranking by it sent
 * Croydon to Cambridgeshire. Well-known places are answered from the local
 * table before we ever ask, so what reaches here is the long tail.
 */
const TOO_SMALL = new Set(["Hamlet"]);

/**
 * postcodes.io matches on substrings, so it answers "me" with Pity Me and
 * "evening" with Eveninghill. Accept a result only when the name really is the
 * place asked for: the same name, or the same first word ("newcastle" ->
 * "Newcastle upon Tyne"). Anything else is a coincidence, not an answer.
 */
function namesThePlace(query: string, name: string | undefined): boolean {
  const asked = query.trim().toLowerCase();
  const got = (name ?? "").trim().toLowerCase();
  if (!asked || !got) return false;
  return got === asked || got.startsWith(`${asked} `);
}

function toOrigin(point: Point | undefined, label: string): Origin | null {
  if (typeof point?.latitude !== "number" || typeof point?.longitude !== "number") return null;
  return { label, latitude: point.latitude, longitude: point.longitude };
}

/**
 * Guarded here as well as in the query parser, because the location box is
 * typed into directly. "The Breck" in Orkney is a real village and passes the
 * name check, so the word has to be rejected before we ever ask.
 */
const NOT_A_PLACE = new Set(["me", "my", "us", "here", "there", "home", "the", "a", "an", "it"]);

export async function geocodeUk(input: string): Promise<Origin | null> {
  const key = input.trim().toLowerCase();
  if (!key || NOT_A_PLACE.has(key)) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const parts = parseLocation(input);
  let origin: Origin | null = null;
  let reachable = true;

  // A full postcode is the most precise thing someone can give us.
  if (parts.clean && /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(parts.clean)) {
    const res = await getJson(`${BASE}/postcodes/${encodeURIComponent(parts.clean)}`);
    reachable &&= res.reachable;
    origin = toOrigin((res.data as { result?: Point } | null)?.result, parts.label || input.trim());
  }

  // Then the district on its own, e.g. OX11.
  if (!origin && parts.district) {
    const res = await getJson(`${BASE}/outcodes/${encodeURIComponent(parts.district)}`);
    reachable &&= res.reachable;
    origin = toOrigin((res.data as { result?: Point } | null)?.result, parts.district);
  }

  // Then the place name.
  if (!origin && parts.raw && !parts.clean) {
    // limit=100, not 5: postcodes.io returns ten rows for "Newcastle" and the
    // city is seventh, so a short list dropped it before anything could pick.
    const res = await getJson(`${BASE}/places?q=${encodeURIComponent(parts.raw)}&limit=100`);
    reachable &&= res.reachable;

    const candidates =
      (res.data as { result?: (Point & { name_1?: string; local_type?: string })[] } | null)?.result ?? [];
    const [best] = candidates
      .filter((c) => namesThePlace(parts.raw, c.name_1))
      .filter((c) => !TOO_SMALL.has(c.local_type ?? ""));

    if (best) origin = toOrigin(best, best.name_1 || parts.raw);
  }

  // Only remember an answer we actually got. Caching a network failure would
  // black-hole a perfectly real town for the life of the process.
  if (origin || reachable) cache.set(key, origin);
  return origin;
}
