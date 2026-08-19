/**
 * Turns "Warhammer clubs near Oxford within 20 miles" into directory filters.
 *
 * Started as a port of the legacy app's `build_directory_ai_search_fallback`
 * (that app calls OpenAI first and falls back to this when OPENAI_API_KEY is
 * unset, which it is). Two of its rules are deliberately not reproduced,
 * because both put filters on searches that never asked for them:
 *
 *   - it scored a match when any single token appeared anywhere in the string,
 *     so "Co-Op Games" matched "didcot" and "cobham" on the letters "co";
 *   - it preferred a city filter over the place name even when the query gave a
 *     radius, which pinned "near Didcot within 20 miles" to that one town.
 *
 * Matching here is whole-word, and a radius always measures from the place.
 */

import { joinFacets } from "./facets";
import { fold, padded } from "./text";

export type SmartSearchOptions = {
  cities: string[];
  formats: { slug: string; label: string }[];
  days: string[];
  facets: string[];
  /** The radius values the dropdown offers, so a parsed one can be snapped to them. */
  withinMiles?: string[];
  /** Likewise the rating steps: the control only offers 4, 3 and 2. */
  reviewRatings?: string[];
};

export type SmartSearchResult = {
  q: string;
  city: string;
  format: string;
  day: string;
  location: string;
  withinMiles: string;
  reviewRating: string;
  sort: string;
  /** Plain-English readback, so it's obvious what the box decided. */
  summary: string;
};

/**
 * Words too common to identify anything on their own. Without this, "games"
 * would pull in every format and "the" would match "Magic: The Gathering".
 */
const GENERIC = new Set([
  "a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with",
  "club", "clubs", "game", "games", "gaming", "play", "playing", "near",
  "nearby", "around", "within", "mile", "miles", "me", "my", "any", "some",
  "that", "this", "best", "top", "good", "great", "find", "show", "looking",
  "star", "stars", "rated", "rating", "session", "sessions", "open", "night",
]);

/**
 * Words that follow "near" or "in" without naming anywhere. Left in, they get
 * geocoded: postcodes.io answers "me" with Pity Me in County Durham and "the"
 * with The Breck in Orkney, so "clubs near me" searched the north east.
 */
const NON_PLACES = new Set([
  "me", "my", "us", "here", "there", "home", "work", "town", "city", "area",
  "the", "a", "an", "and", "or", "it", "one", "some", "any", "this", "that",
  "evening", "evenings", "night", "nights", "weekend", "weekends", "morning",
  "afternoon", "week", "month", "day", "days", "future", "person", "general",
]);

const distinctiveTokens = (label: string) =>
  fold(label).split(" ").filter((t) => t.length >= 3 && !GENERIC.has(t));

/**
 * Strict match, for filters where a wrong guess visibly breaks the results:
 * city, format and day. The whole phrase must appear, or every distinctive
 * word in it must appear. Both as whole words.
 *
 * The previous version scored a hit when any single token appeared anywhere in
 * the string, so "Co-Op Games" matched "didcot" and "cobham" through the two
 * letters "co". That put a format filter on searches that never asked for one.
 */
function matchStrict(query: string, options: string[]): string {
  const haystack = padded(query);
  let best = "";
  let bestScore = -1;

  for (const option of options) {
    const phrase = fold(option);
    if (!phrase) continue;

    const tokens = distinctiveTokens(option);
    let score = 0;

    if (haystack.includes(` ${phrase} `)) score = 3;
    else if (tokens.length > 0 && tokens.every((t) => haystack.includes(` ${t} `))) score = 2;

    // Longer labels win ties, so "Warhammer 40,000" beats "Warhammer".
    if (score > 0 && (score > bestScore || (score === bestScore && option.length > best.length))) {
      bestScore = score;
      best = option;
    }
  }

  return best;
}

/**
 * Loose match, for games and facilities. Returns the wording the person used
 * rather than the catalogue label: "cafe" finds both "Cafe bar" and "Cafe
 * counter", and searching for the word beats picking one of them arbitrarily,
 * because every term is required and two cafe labels together match nothing.
 */
type FacetHit = {
  value: string;
  /** True when the query spelled the whole label out, false for a single word. */
  exact: boolean;
};

function matchFacets(query: string, facets: string[]): FacetHit[] {
  const haystack = padded(query);
  const hits: FacetHit[] = [];
  const seen = new Set<string>();

  const add = (value: string, exact: boolean) => {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      hits.push({ value, exact });
    }
  };

  // Whole labels first, longest to shortest, so "Warhammer 40,000" is preferred
  // over "Warhammer" when the query spells it out. Every term has to match, so
  // adding both would narrow the results for no reason.
  const byLength = [...facets].sort((a, b) => b.length - a.length);
  for (const facet of byLength) {
    const phrase = fold(facet);
    if (!haystack.includes(` ${phrase} `)) continue;
    if (hits.some((h) => fold(h.value).includes(phrase))) continue;
    add(facet, true);
  }

  // Then single distinctive words. This used to be skipped whenever any label
  // had matched, so "warhammer and a cafe" kept Warhammer and quietly dropped
  // the cafe. Anything already covered by a matched label is still skipped.
  for (const facet of byLength) {
    for (const token of distinctiveTokens(facet)) {
      if (!haystack.includes(` ${token} `)) continue;
      if (hits.some((h) => fold(h.value).includes(token))) continue;
      add(token, false);
    }
  }

  return hits;
}

/**
 * Full postcode wins outright; otherwise take what follows "near"/"around"/"in".
 * `byProximity` records which preposition was used, because "near Didcot" asks
 * for a radius while "in Didcot" asks for that town.
 */
function locationHint(query: string): { value: string; byProximity: boolean } {
  const postcode = query.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  if (postcode) return { value: postcode[1].toUpperCase(), byProximity: true };

  const near = query.match(/\b(near|around|in)\s+([A-Za-z0-9][A-Za-z0-9\s\-']{1,40})/i);
  if (!near) return { value: "", byProximity: false };

  const value = near[2]
    // Stop at anything that plainly is not part of a place name. The geocoder
    // trims trailing words too, but the chip reads "Near London this Saturday"
    // unless the parser gets it right here.
    .split(
      /\b(?:with|for|on|within|open|that|showing|and|this|next|tonight|today|tomorrow|playing|plays|please|area|monday|tuesday|wednesday|thursday|friday|saturday|sunday|evening|weekend|morning|afternoon)\b/i,
    )[0]
    .trim()
    .replace(/^[\s,.]+|[\s,.]+$/g, "");

  const words = fold(value).split(" ").filter(Boolean);
  if (words.length === 0 || words.every((w) => NON_PLACES.has(w))) {
    return { value: "", byProximity: false };
  }

  return { value, byProximity: near[1].toLowerCase() !== "in" };
}

const SORT_ALIASES: [string, string[]][] = [
  ["membership-price", ["lowest membership", "cheapest membership", "lowest price", "cheapest regular", "cheapest fee"]],
  ["next-session", ["soonest next session", "next session", "meeting soonest", "meets soonest", "club night soonest"]],
  ["members", ["most members", "largest club", "largest community", "biggest club", "biggest community"]],
  ["newest", ["newest clubs", "new clubs", "recently listed", "latest clubs", "latest listings"]],
  ["reviews", ["most reviewed", "review volume", "most reviews"]],
  ["rating", ["best rated", "highest rated", "highest rating", "top rated"]],
  ["distance", ["nearest", "closest", "distance"]],
];

function inferSort(folded: string, location: string, withinMiles: string): string {
  for (const [value, aliases] of SORT_ALIASES) {
    if (aliases.some((alias) => folded.includes(alias))) return value;
  }
  return location || withinMiles ? "distance" : "relevance";
}

function buildSummary(parts: {
  format: string; facets: string[]; city: string; location: string;
  day: string; withinMiles: string; reviewRating: string;
}): string {
  const bits: string[] = [];
  if (parts.format) bits.push(parts.format);
  if (parts.facets.length) bits.push(parts.facets.join(", "));
  if (parts.city) bits.push(`in ${parts.city}`);
  else if (parts.location) bits.push(`near ${parts.location}`);
  if (parts.day) bits.push(`on ${parts.day}`);
  if (parts.withinMiles) bits.push(`within ${parts.withinMiles} miles`);
  if (parts.reviewRating) bits.push(`rated ${parts.reviewRating}+ stars`);

  return bits.length
    ? `Showing clubs matching ${bits.join(" ")}.`
    : "Applied your search without adding extra filters.";
}

export function parseSmartSearch(rawQuery: string, options: SmartSearchOptions): SmartSearchResult {
  const query = rawQuery.trim();
  const folded = fold(query);
  const haystack = padded(query);

  const day = options.days.find((d) => haystack.includes(` ${fold(d)} `)) ?? "";

  const rating = folded.match(/\b([1-5])\s*(?:\+?\s*)?(?:star|stars)\b/);
  const miles = folded.match(/\b(\d{1,3})\s*miles?\b/);

  /**
   * Each reading takes its words out of the text before the next one looks.
   *
   * The order matters and it is not arbitrary. Numbers go first: "5 star clubs"
   * was reading "star" as a game and cutting the list to Star Wars clubs. Games
   * and facilities go next, because they are the most specific thing someone
   * names. Format goes last on what is left, so "Pokemon TCG clubs" no longer
   * adds a TCG format filter on top of the game and drops a club that plays it.
   */
  const withoutNumbers = query
    .replace(/\b[1-5]\s*\+?\s*stars?\b/gi, " ")
    .replace(/\b\d{1,3}\s*miles?\b/gi, " ");

  const facetHits = matchFacets(withoutNumbers, options.facets);

  /**
   * A game the user spelled out in full wins over a format that happens to
   * share a word with it. "Pokemon TCG clubs" was setting the TCG format on top
   * of the game and dropping a club that plays it. Removing the named game
   * first leaves nothing for the format to latch onto.
   *
   * Done on folded text so an accent cannot prevent the removal: the label is
   * "Pokémon TCG" and almost nobody types the accent.
   */
  const withoutFacets = facetHits
    .filter((h) => h.exact)
    .reduce((text, h) => text.split(` ${fold(h.value)} `).join(" "), padded(withoutNumbers));

  const formatLabel = matchStrict(withoutFacets, options.formats.map((f) => f.label));
  const format = options.formats.find((f) => f.label === formatLabel)?.slug ?? "";

  /**
   * The reverse case: a single word matched loosely should give way to a format
   * that covers it. "family friendly" means the Family Games format, not a
   * requirement that a club writes the word "family", which dropped a real
   * family club.
   */
  const claimed = new Set(formatLabel ? distinctiveTokens(formatLabel) : []);
  const facets = facetHits
    .filter((h) => h.exact || !claimed.has(fold(h.value)))
    .map((h) => h.value);
  /**
   * "within 7 miles" is a reasonable thing to type, but the dropdown only
   * offers fixed steps, so an unlisted value left it rendering blank while
   * still filtering. Round up to the next step the control can show.
   */
  const snapMiles = (value: string): string => {
    const steps = options.withinMiles ?? [];
    if (!value || steps.length === 0) return value;
    if (steps.includes(value)) return value;
    const asked = Number(value);
    const next = steps
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
      .find((n) => n >= asked);
    return next !== undefined ? String(next) : String(Math.max(...steps.map(Number)));
  };

  const parsedMiles = miles ? snapMiles(miles[1]) : "";
  // "5 star clubs" is natural to type but the control tops out at 4, so an
  // unlisted value left the dropdown blank while still filtering.
  const steps = (options.reviewRatings ?? []).map(Number).filter(Number.isFinite);
  const asked = rating ? Number(rating[1]) : NaN;
  const reviewRating = rating
    ? steps.length === 0 || steps.includes(asked)
      ? rating[1]
      : String(Math.max(...steps.filter((n) => n <= asked), Math.min(...steps)))
    : "";

  const place = locationHint(query);
  const cityMatch = matchStrict(query, options.cities);

  /**
   * "near Didcot within 20 miles" is a radius search, not a request for clubs
   * whose town is called Didcot. Setting city instead pinned it to that one
   * town and the radius did nothing, so a 20-mile search returned a single club
   * when three sit inside it.
   *
   * A distance, or the word "near"/"around", means measure from the place.
   * A plain "in Didcot" still filters by town.
   */
  const wantsRadius = Boolean(parsedMiles) || place.byProximity;
  const useCity = Boolean(cityMatch) && !wantsRadius;

  const city = useCity ? cityMatch : "";
  const location = useCity ? "" : place.value || (cityMatch ? cityMatch : "");

  // "within 20 miles" with nowhere to measure from used to be shown as an
  // applied filter while the service ignored it, so the page claimed a radius
  // and listed the whole country.
  const withinMiles = location ? parsedMiles : "";

  return {
    q: joinFacets(facets),
    city,
    format,
    day,
    location,
    withinMiles,
    reviewRating,
    sort: inferSort(folded, location, withinMiles),
    summary: buildSummary({ format: formatLabel, facets, city, location, day, withinMiles, reviewRating }),
  };
}
