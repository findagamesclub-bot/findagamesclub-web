import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/** The only place that queries the clubs tables. Returns rows; the service maps them. */

/** Cards show the club's first image, so the list carries it too. */
export type ClubRow = Tables<"clubs"> & {
  club_images?: { src: string; alt: string; position: number }[];
  club_social_links?: { label: string; url: string; position: number }[];
};

const LIST_COLUMNS =
  "id, slug, name, city, neighbourhood, summary, spotlight, status, " +
  "tables_available, member_count, price_drop_in, legacy_created_at, search_haystack, " +
  "venue_postcode, venue_postcode_district, venue_postcode_area, " +
  "latitude, longitude, club_images(src, alt, position), " +
  "club_social_links(label, url, position)";

export type ClubSort = "relevance" | "name" | "members" | "city";

export type ListParams = {
  search?: string;
  city?: string;
  /** Taxonomy slugs. */
  format?: string;
  game?: string;
  facility?: string;
  /** Full day name, e.g. "Thursday". */
  day?: string;
  sort?: ClubSort;
  limit?: number;
  offset?: number;
};

/**
 * Filtering by a related table needs the matching club ids first — PostgREST
 * can't express "clubs having a row in club_games where slug = x" in one call
 * without turning the join into an inner join and duplicating rows.
 */
async function clubIdsMatching(params: ListParams): Promise<number[] | null> {
  const supabase = await createClient();
  const sets: number[][] = [];

  if (params.format) {
    const { data, error } = await supabase
      .from("club_formats").select("club_id, formats!inner(slug)").eq("formats.slug", params.format);
    if (error) throw new Error(`Failed to filter by format: ${error.message}`);
    sets.push((data ?? []).map((r) => r.club_id));
  }

  if (params.game) {
    const { data, error } = await supabase
      .from("club_games").select("club_id, games!inner(slug)").eq("games.slug", params.game);
    if (error) throw new Error(`Failed to filter by game: ${error.message}`);
    sets.push((data ?? []).map((r) => r.club_id));
  }

  if (params.facility) {
    const { data, error } = await supabase
      .from("club_facilities").select("club_id, facilities!inner(slug)").eq("facilities.slug", params.facility);
    if (error) throw new Error(`Failed to filter by facility: ${error.message}`);
    sets.push((data ?? []).map((r) => r.club_id));
  }

  if (params.day) {
    const { data, error } = await supabase
      .from("club_sessions").select("club_id").ilike("day", params.day);
    if (error) throw new Error(`Failed to filter by day: ${error.message}`);
    sets.push((data ?? []).map((r) => r.club_id));
  }

  if (sets.length === 0) return null;

  // Filters combine with AND: a club must appear in every set.
  return sets.reduce((acc, set) => acc.filter((id) => set.includes(id)));
}

export async function findActiveClubs(params: ListParams = {}) {
  const { search, city, sort = "relevance", limit = 24, offset = 0 } = params;
  const supabase = await createClient();

  const ids = await clubIdsMatching(params);
  if (ids !== null && ids.length === 0) return { rows: [], total: 0 };

  let query = supabase.from("clubs").select(LIST_COLUMNS, { count: "exact" }).eq("status", "active");

  if (ids !== null) query = query.in("id", [...new Set(ids)]);
  if (city) query = query.ilike("city", city);
  // Trigram indexes back these, so partial and misspelled names still match.
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,summary.ilike.%${search}%`);

  if (sort === "name") query = query.order("name");
  else if (sort === "members") query = query.order("member_count", { ascending: false, nullsFirst: false });
  else if (sort === "city") query = query.order("city").order("name");
  else query = query.order("spotlight", { ascending: false }).order("member_count", { ascending: false, nullsFirst: false });

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to load clubs: ${error.message}`);

  return { rows: (data ?? []) as unknown as ClubRow[], total: count ?? 0 };
}

export async function findClubBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Failed to load club ${slug}: ${error.message}`);
  return data;
}

export async function findSessionsForClubs(clubIds: number[]) {
  if (clubIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_sessions").select("club_id, day, time, label").in("club_id", clubIds).order("position");
  if (error) throw new Error(`Failed to load sessions: ${error.message}`);
  return data ?? [];
}

export async function findGamesForClubs(clubIds: number[]) {
  if (clubIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_games").select("club_id, games(slug, label)").in("club_id", clubIds);
  if (error) throw new Error(`Failed to load club games: ${error.message}`);
  return data ?? [];
}

export async function findFormatsForClubs(clubIds: number[]) {
  if (clubIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_formats").select("club_id, formats(slug, label)").in("club_id", clubIds);
  if (error) throw new Error(`Failed to load club formats: ${error.message}`);
  return data ?? [];
}

export async function findFacilitiesForClubs(clubIds: number[]) {
  if (clubIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_facilities").select("club_id, facilities(slug, label)").in("club_id", clubIds);
  if (error) throw new Error(`Failed to load club facilities: ${error.message}`);
  return data ?? [];
}

/** Clubs whose game or facility label matches free text — the search box covers both. */
export async function findClubIdsMatchingText(text: string): Promise<number[]> {
  const supabase = await createClient();
  const like = `%${text}%`;

  const [games, facilities] = await Promise.all([
    supabase.from("club_games").select("club_id, games!inner(label)").ilike("games.label", like),
    supabase.from("club_facilities").select("club_id, facilities!inner(label)").ilike("facilities.label", like),
  ]);
  if (games.error) throw new Error(`Search failed: ${games.error.message}`);
  if (facilities.error) throw new Error(`Search failed: ${facilities.error.message}`);

  return [...new Set([...(games.data ?? []), ...(facilities.data ?? [])].map((r) => r.club_id))];
}

/** Coordinates and postcode parts for every active club, for location resolution. */
export async function findClubLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, city, latitude, longitude, venue_postcode, venue_postcode_district, venue_postcode_area")
    .eq("status", "active");
  if (error) throw new Error(`Failed to load club locations: ${error.message}`);
  return data ?? [];
}

/** Average rating and count per club, for the rating filter and sorts. */
export async function findReviewAggregates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_reviews").select("club_id, rating").is("removed_at", null);
  if (error) throw new Error(`Failed to load reviews: ${error.message}`);

  const totals = new Map<number, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const entry = totals.get(row.club_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    totals.set(row.club_id, entry);
  }
  return new Map(
    [...totals].map(([id, { sum, count }]) => [id, { average: sum / count, count }]),
  );
}

/** Cheapest membership price per club, for the membership-price sort. */
export async function findLowestTierPrices() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("club_membership_tiers").select("club_id, price");
  if (error) throw new Error(`Failed to load tiers: ${error.message}`);

  const lowest = new Map<number, number>();
  for (const row of data ?? []) {
    const amount = Number(String(row.price).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amount) || amount === 0) continue;
    const current = lowest.get(row.club_id);
    if (current === undefined || amount < current) lowest.set(row.club_id, amount);
  }
  return lowest;
}

/** Membership tiers with their billing options, for the monthly-price sort. */
export async function findTierPricing() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers").select("club_id, price, price_duration, billing_options");
  if (error) throw new Error(`Failed to load tier pricing: ${error.message}`);
  return data ?? [];
}

/** Pricing models per club — the membership-price sort falls back to these. */
export async function findPricingModels(clubIds: number[]) {
  if (clubIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_pricing_models").select("club_id, label, price").in("club_id", clubIds);
  if (error) throw new Error(`Failed to load pricing models: ${error.message}`);
  return data ?? [];
}

/** Everything the club page renders, in one round trip. */
export async function findClubDetail(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(
      `*,
       club_sessions(day, time, label, position),
       club_images(src, alt, position),
       club_social_links(label, url, position),
       club_pricing_models(label, price, notes, position),
       club_announcements(message, created_at),
       club_membership_tiers(tier_key, label, price, price_duration, description, is_basic, position, benefits, billing_options),
       club_membership_settings(*),
       club_formats(formats(slug, label)),
       club_games(games(slug, label)),
       club_facilities(facilities(slug, label)),
       club_payment_methods(payment_methods(slug, label)),
       club_discussion_categories(label, position),
       club_events(id, legacy_id, title, summary, start_date, start_time, end_date, end_time,
                   event_type, price, round_count, tickets_available, venue_name),
       club_reviews(id, author_profile_id, author_name, rating, comment, created_at,
                    flagged_at, flagged_by_name, removed_at)`
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`Failed to load club ${slug}: ${error.message}`);
  return data;
}

/** Roster is signed-in only, so it is fetched separately and may come back empty. */
export async function findClubRoster(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_members").select("name, initials").eq("club_id", clubId).order("position");
  if (error) return [];
  return data ?? [];
}
