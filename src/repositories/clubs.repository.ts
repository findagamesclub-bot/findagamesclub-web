import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLUB_MEDIA, isClubMediaPath } from "@/utils/club-media";
import type { Tables } from "@/types/database";

/** The only place that queries the clubs tables. Returns rows; the service maps them. */

/** Cards show the club's first image, so the list carries it too. */
export type ClubRow = Tables<"clubs"> & {
  club_images?: {
    src: string; alt: string; position: number;
    /** Set for anything uploaded here; the legacy rows carry `src` instead. */
    storage_path?: string | null;
  }[];
  club_social_links?: { label: string; url: string; position: number }[];
};

const LIST_COLUMNS =
  "id, slug, name, city, neighbourhood, summary, spotlight, status, logo_url, " +
  "tables_available, member_count, ages, price_drop_in, legacy_created_at, search_haystack, " +
  "venue_postcode, venue_postcode_district, venue_postcode_area, " +
  "latitude, longitude, club_images(src, alt, position, storage_path), " +
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
/**
 * The newest reviews carried with the club page.
 *
 * A ceiling rather than paging: the rating breakdown and the average are
 * computed from what is loaded, so a page of reviews at a time would make both
 * of them lie. No club in the directory is within two orders of magnitude of
 * this, and `countReviews` says plainly when it bites.
 */
export const REVIEW_CAP = 500;

export async function findClubDetail(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(
      `*,
       club_sessions(day, time, label, position),
       club_images(src, alt, position, storage_path),
       club_social_links(label, url, position),
       club_pricing_models(label, price, notes, position),
       club_announcements(id, message, created_at),
       club_membership_tiers(tier_key, label, price, price_duration, description, is_basic, position, benefits, billing_options),
       club_membership_settings(*),
       club_formats(formats(slug, label)),
       club_games(games(slug, label)),
       club_facilities(facilities(slug, label)),
       club_payment_methods(payment_methods(slug, label)),
       club_discussion_categories(label, position),
       club_reviews(id, author_profile_id, author_name, rating, comment, created_at,
                    flagged_at, flagged_by_name, removed_at)`
    )
    // Events are queried separately and paged. Embedded here, every visit to
    // every club page paid for ten years of them to show the next three.
    .order("created_at", { referencedTable: "club_reviews", ascending: false })
    .limit(REVIEW_CAP, { referencedTable: "club_reviews" })
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

/**
 * Save the club's own columns.
 *
 * The zero-row trap: a write RLS filters out affects nothing and returns no
 * error, so this proves it touched a row rather than trusting `error` to be
 * null. `club_can(id, 'listing.edit')` is what decides, and a helper reaching
 * this gets `NOT_PERMITTED` rather than a quiet success.
 *
 * Coordinates, slug and status are not here and never will be: the trigger on
 * this table flags a moved club for re-geocoding instead.
 */
export async function updateClubProfile(clubId: number, patch: {
  name: string;
  city: string;
  neighbourhood: string | null;
  summary: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_postcode: string | null;
  website_url: string | null;
  contact_email: string | null;
  ages: string | null;
  member_count: number | null;
  tables_available: number | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", clubId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** What the listing editor needs to fill its own fields in. */
export async function findClubForEditing(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select(`id, slug, name, city, neighbourhood, summary, description, venue_name,
             venue_address, venue_postcode, website_url, contact_email, contact_phone,
             ages, member_count, tables_available, geocode_stale`)
    .eq("id", clubId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Replace a club's photos.
 *
 * Delete then insert, because order is a column and the editor's whole answer
 * is an order. The rows carry either a `storage_path` for a file we hold or a
 * legacy `src` for one imported from the old site, and one mapper resolves
 * whichever is set.
 */
export async function replaceClubImages(clubId: number, rows: {
  storage_path: string | null; src: string; alt: string;
}[]) {
  const supabase = await createClient();

  const { error: cleared } = await supabase.from("club_images").delete().eq("club_id", clubId);
  if (cleared) throw new Error(cleared.message);
  if (!rows.length) return;

  const { error } = await supabase.from("club_images").insert(
    rows.map((row, index) => ({ club_id: clubId, ...row, position: index })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Delete the files behind photos a club has just taken off its listing.
 *
 * Through the caller's own client, so the storage policy decides, and only
 * after the rows that pointed at them are gone. A path that is already gone
 * is the outcome we wanted, so it is not an error.
 */
export async function removeClubMedia(clubId: number, paths: string[]) {
  const mine = paths.filter((path) => isClubMediaPath(path, clubId));
  if (!mine.length) return;

  const supabase = await createClient();
  const { error } = await supabase.storage.from(CLUB_MEDIA).remove(mine);
  if (error) throw new Error(error.message);
}

/** Replace a club's social links, in the order the networks are listed. */
export async function replaceClubSocialLinks(clubId: number, rows: {
  label: string; url: string;
}[]) {
  const supabase = await createClient();

  const { error: cleared } = await supabase.from("club_social_links").delete().eq("club_id", clubId);
  if (cleared) throw new Error(cleared.message);
  if (!rows.length) return;

  const { error } = await supabase.from("club_social_links").insert(
    rows.map((row, index) => ({ club_id: clubId, ...row, position: index })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Replace a club's noticeboard.
 *
 * Delete then insert: the notices are a list in an order, and legacy derives
 * the club's single `announcement` field from the first of them.
 */
export async function replaceClubAnnouncements(clubId: number, messages: string[]) {
  const supabase = await createClient();

  const { error: cleared } = await supabase
    .from("club_announcements").delete().eq("club_id", clubId);
  if (cleared) throw new Error(cleared.message);
  if (!messages.length) return;

  const { error } = await supabase.from("club_announcements").insert(
    messages.map((message) => ({ club_id: clubId, message })),
  );
  if (error) throw new Error(error.message);
}

/** Replace the drop-in prices. `price` and `notes` are NOT NULL with empty defaults. */
export async function replaceClubPricingModels(clubId: number, rows: {
  label: string; price: string; notes: string;
}[]) {
  const supabase = await createClient();

  const { error: cleared } = await supabase
    .from("club_pricing_models").delete().eq("club_id", clubId);
  if (cleared) throw new Error(cleared.message);
  if (!rows.length) return;

  const { error } = await supabase.from("club_pricing_models").insert(
    rows.map((row, index) => ({ club_id: clubId, ...row, position: index })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Switch the points programme on or off.
 *
 * Update then insert, never upsert: PostgREST puts every payload column into
 * `ON CONFLICT DO UPDATE`, `club_id` included, and update on `club_id` is
 * withheld on purpose so a settings row cannot be moved to another club.
 */
export async function setLoyaltyEnabled(clubId: number, enabled: boolean) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_loyalty_settings")
    .update({ enabled }).eq("club_id", clubId).select("club_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;

  const { error: failed } = await supabase
    .from("club_loyalty_settings").insert({ club_id: clubId, enabled });
  if (failed && failed.code !== "23505") throw new Error(failed.message);
}

/**
 * Put a club on the map, and clear the flag that said it had moved.
 *
 * Through the service-role client because `latitude`, `longitude` and
 * `geocode_stale` are in no grant: a browser that could write them could pin a
 * club anywhere, and one that could clear the flag could move and then lie
 * about having moved.
 */
export async function placeClub(
  clubId: number, latitude: number, longitude: number, label: string | null,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("clubs")
    .update({
      latitude, longitude, coordinates_label: label, geocode_stale: false,
    } as never)
    .eq("id", clubId);
  if (error) throw new Error(error.message);
}
