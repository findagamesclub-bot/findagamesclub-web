import "server-only";

import { table, type TableRow } from "@/lib/supabase/table";

/**
 * Exactly what `findEvent` selects.
 *
 * Hand-written because `status` and `cancel_reason` arrived with 0090 and the
 * generated types have not been regenerated yet. Spelled out as `Pick`s rather
 * than whole rows so a column nobody selected cannot be read as though it were
 * there. Delete it with the rest of the shim.
 */
type EventRow = Pick<TableRow<"club_events">,
  "id" | "legacy_id" | "title" | "summary" | "start_date" | "start_time" | "end_date"
  | "end_time" | "event_type" | "event_types" | "formats" | "featured_games" | "facilities"
  | "round_count" | "price" | "tickets_available" | "venue_name" | "venue_address"
  | "venue_postcode" | "info_board" | "bestcoast_link" | "logo_src" | "logo_alt"
> & {
  status: string;
  cancel_reason: string | null;
  clubs: Pick<TableRow<"clubs">, "id" | "slug" | "name" | "owner_id" | "venue_name"
    | "venue_address" | "venue_postcode" | "latitude" | "longitude"> & {
    club_images: Pick<TableRow<"club_images">, "src" | "alt" | "position">[] | null;
    club_membership_tiers: TableRow<"club_membership_tiers">[] | null;
  };
  club_event_ticket_types: Pick<TableRow<"club_event_ticket_types">, "id" | "label" | "price"
    | "audience" | "audience_label" | "minimum_tier_key" | "quantity_available" | "position">[] | null;
  club_event_results: Pick<TableRow<"club_event_results">, "id" | "rank" | "placement"
    | "member_name" | "member_profile_id" | "is_member" | "army">[] | null;
};

/**
 * One event with everything hanging off it.
 *
 * Legacy rebuilds this from four JSON files per request (club_store.py:2493).
 * Here it is one query with three embedded selects, which is the same round
 * trip whether an event has three placings or three hundred.
 */
export async function findEvent(clubSlug: string, legacyId: string) {
  const events = await table<EventRow>("club_events");
  const { data, error } = await events
    .select(
      `id, legacy_id, title, summary, start_date, start_time, end_date, end_time,
       event_type, event_types, formats, featured_games, facilities, round_count,
       price, tickets_available, venue_name, venue_address, venue_postcode,
       info_board, bestcoast_link, logo_src, logo_alt, status, cancel_reason,
       clubs!inner(id, slug, name, owner_id, venue_name, venue_address, venue_postcode,
                   latitude, longitude, club_images(src, alt, position),
                   club_membership_tiers(tier_key, label, price, price_duration, description,
                                         is_basic, position, benefits, billing_options)),
       club_event_ticket_types(id, label, price, audience, audience_label, minimum_tier_key, quantity_available, position),
       club_event_results(id, rank, placement, member_name, member_profile_id, is_member, army)`,
    )
    .eq("clubs.slug", clubSlug)
    .eq("legacy_id", legacyId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load event: ${error.message}`);
  return data;
}
