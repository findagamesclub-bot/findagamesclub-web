/**
 * Turns "Warhammer clubs near Oxford within 20 miles" into directory filters.
 *
 * This is a port of the legacy app's `build_directory_ai_search_fallback`. That
 * app tries OpenAI first and falls back to this when `OPENAI_API_KEY` is unset —
 * which it is, so the parser below is what the client's site actually runs
 * today. Same rules, same precedence, so results match.
 */

export type SmartSearchOptions = {
  cities: string[];
  formats: { slug: string; label: string }[];
  days: string[];
  facets: string[];
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

const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Element-wise, like Python's tuple comparison in the original. JavaScript's
 * `>` on arrays stringifies first, which would rank [2,1,16] below [2,1,9].
 */
function scoreBeats(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/**
 * Ranked match, mirroring the legacy scoring: exact beats substring, which
 * beats all-tokens-present, which beats any-token-present. Ties break on the
 * longer option, so "Warhammer 40,000" wins over "Warhammer".
 */
function matchOption(query: string, options: string[]): string {
  const foldedQuery = fold(query);
  if (!foldedQuery) return "";

  let best = "";
  let bestScore: [number, number, number] = [-1, -1, -1];

  for (const option of options) {
    const foldedOption = fold(option);
    if (!foldedOption) continue;

    const tokens = foldedOption.split(" ").filter(Boolean);
    let rank = 0;
    let tokenRank = 0;

    if (foldedOption === foldedQuery) rank = 4;
    else if (foldedQuery.includes(foldedOption) || foldedOption.includes(foldedQuery)) rank = 3;
    else if (tokens.every((t) => foldedQuery.includes(t))) {
      rank = 2;
      tokenRank = tokens.length;
    } else if (tokens.some((t) => foldedQuery.includes(t))) {
      rank = 1;
      tokenRank = tokens.filter((t) => foldedQuery.includes(t)).length;
    }

    const score: [number, number, number] = [rank, tokenRank, option.length];
    if (scoreBeats(score, bestScore)) {
      bestScore = score;
      best = option;
    }
  }

  return bestScore[0] > 0 ? best : "";
}

/** Full postcode wins outright; otherwise take what follows "near"/"around"/"in". */
function locationHint(query: string): string {
  const postcode = query.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
  if (postcode) return postcode[1].toUpperCase();

  const near = query.match(/\b(?:near|around|in)\s+([A-Za-z0-9][A-Za-z0-9\s\-']{1,40})/i);
  if (!near) return "";

  return near[1]
    .split(/\b(?:with|for|on|within|open|that|showing)\b/i)[0]
    .trim()
    .replace(/^[\s,.]+|[\s,.]+$/g, "");
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

  const day = options.days.find((d) => folded.includes(fold(d))) ?? "";
  const city = matchOption(query, options.cities);
  const formatLabel = matchOption(query, options.formats.map((f) => f.label));
  const format = options.formats.find((f) => f.label === formatLabel)?.slug ?? "";

  // Only facets the directory actually knows about, so the query can't invent one.
  const facets = options.facets.filter((facet) => folded.includes(fold(facet)));

  const rating = folded.match(/\b([1-5])\s*(?:\+?\s*)?(?:star|stars)\b/);
  const miles = folded.match(/\b(\d{1,3})\s*miles?\b/);

  let location = locationHint(query);
  if (city && location && city.toLowerCase() === location.toLowerCase()) location = "";

  const withinMiles = miles ? miles[1] : "";
  const reviewRating = rating ? rating[1] : "";

  return {
    q: facets.join(", "),
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
