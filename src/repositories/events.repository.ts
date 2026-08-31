import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * One event with everything hanging off it.
 *
 * Legacy rebuilds this from four JSON files per request (club_store.py:2493).
 * Here it is one query with three embedded selects, which is the same round
 * trip whether an event has three placings or three hundred.
 */
export async function findEvent(clubSlug: string, legacyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_events")
    .select(
      `id, legacy_id, title, summary, start_date, start_time, end_date, end_time,
       event_type, event_types, formats, featured_games, facilities, round_count,
       price, tickets_available, venue_name, venue_address, venue_postcode,
       info_board, bestcoast_link,
       clubs!inner(id, slug, name, owner_id, venue_name, venue_address, venue_postcode,
                   latitude, longitude, club_images(src, alt, position),
                   club_membership_tiers(tier_key, label, price, price_duration, description,
                                         is_basic, position, benefits, billing_options)),
       club_event_ticket_types(id, label, price, audience, audience_label, minimum_tier_key, quantity_available, position),
       club_event_results(id, rank, placement, member_name, member_profile_id, is_member, army),
       club_event_pairings(id, round, label, matches)`,
    )
    .eq("clubs.slug", clubSlug)
    .eq("legacy_id", legacyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load event: ${error.message}`);
  return data;
}

/** Events across the whole directory, for the events search mode. */
export async function findEvents(params: { from?: string; to?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from("club_events")
    .select(
      `id, legacy_id, title, summary, start_date, start_time, end_date, end_time, event_type,
       event_types, formats, facilities,
       price, round_count, tickets_available,
       venue_name, venue_address, venue_postcode, featured_games,
       club_event_ticket_types(price),
       clubs!inner(slug, name, city, logo_url, status, latitude, longitude,
                   club_images(src, alt, position),
                   club_formats(formats(label))),
       club_event_results(rank, placement, member_name, army)`,
    )
    .eq("clubs.status", "active");

  if (params.from) query = query.gte("start_date", params.from);
  if (params.to) query = query.lte("start_date", params.to);

  const { data, error } = await query
    .order("start_date", { ascending: true })
    .limit(params.limit ?? 200);

  if (error) throw new Error(`Failed to load events: ${error.message}`);
  return data ?? [];
}

/** Every event at a set of clubs, for the list of events somebody runs. */
export async function findEventsForClubs(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_events")
    .select(
      `id, legacy_id, title, summary, start_date, start_time, end_date, end_time, event_type,
       price, round_count, tickets_available,
       venue_name, venue_address, venue_postcode, club_id,
       clubs!inner(id, slug, name)`,
    )
    .in("club_id", clubIds)
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to load your events: ${error.message}`);
  return data ?? [];
}

/**
 * One page of a club's events, past or upcoming.
 *
 * Separate from the club detail query, which pulls every event a club has ever
 * run alongside the club itself. That was fine at nineteen events and is not
 * at ten years of them, and the club page only ever shows the next few.
 *
 * The date test is the SQL half of `hasEnded`: an event is past once its last
 * day is behind us. `hasEnded` still runs per row for the label, because on
 * the day itself only an end time can call a thing finished.
 */
export async function findClubEventsPage(
  clubId: number,
  params: { past: boolean; today: string; from: number; to: number },
) {
  const supabase = await createClient();
  const { past, today } = params;

  const query = supabase
    .from("club_events")
    .select(
      `id, legacy_id, title, summary, start_date, start_time, end_date, end_time,
       event_type, price, round_count, tickets_available,
       venue_name, venue_address, venue_postcode`,
      { count: "exact" },
    )
    .eq("club_id", clubId)
    // An event with no end date is a one-day event, so its start date decides.
    .or(past
      ? `end_date.lt.${today},and(end_date.is.null,start_date.lt.${today})`
      : `end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
    .order("start_date", { ascending: !past })
    .range(params.from, params.to);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to load club events: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}
