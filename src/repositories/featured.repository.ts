import "server-only";

import { createAnonClient } from "@/lib/supabase/anon";
import { callRpc, table } from "@/lib/supabase/table";

/**
 * Featured slots.
 *
 * Who leads the homepage is the same answer for every visitor, so the read is
 * sessionless and the service caches it. RLS still applies: the slots are
 * readable by `anon` on purpose, because what is featured today is on the front
 * page and hiding the row while showing the result would be theatre.
 */

export type FeaturedSlotRow = {
  id: number;
  club_id: number;
  starts_on: string;
  ends_on: string;
  price_pence: number;
  currency: string;
  note: string;
  created_at: string;
  club?: { slug: string; name: string; city: string; status: string } | null;
};

const COLUMNS =
  `id, club_id, starts_on, ends_on, price_pence, currency, note, created_at,
   club:clubs(slug, name, city, status)`;

/** Every slot, for the admin screen. Newest booking first. */
export async function findSlots(): Promise<FeaturedSlotRow[]> {
  const rows = await table<FeaturedSlotRow>("featured_listings");
  const { data, error } = await rows
    .select(COLUMNS)
    .order("starts_on", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`Failed to load the featured slots: ${error.message}`);
  return data ?? [];
}

/**
 * Who leads the homepage today.
 *
 * The function decides, not this: paid slots first and `spotlight` filling
 * whatever is left. `paid` comes back per row so the page can say "Featured"
 * only about the ones that are.
 *
 * By slug, because that is how the directory rows it joins to are addressed.
 */
export type FeaturedClubRow = { club_id: number; slug: string; paid: boolean };

export async function findFeaturedClubs(limit: number): Promise<FeaturedClubRow[]> {
  const supabase = createAnonClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: FeaturedClubRow[] | null;
      error: { message: string } | null;
    }>;
  }).rpc("featured_clubs", { p_limit: limit });

  if (error) throw new Error(`Failed to load the featured clubs: ${error.message}`);
  return data ?? [];
}

export const featureClub = (params: {
  club: number; from: string; to: string | null;
  pricePence: number | null; note: string;
}) => callRpc<number>("feature_club", {
  p_club: params.club,
  p_from: params.from,
  p_to: params.to,
  p_price_pence: params.pricePence,
  p_note: params.note,
});

export const unfeatureClub = (slot: number) =>
  callRpc<boolean>("unfeature_club", { p_slot: slot });

/**
 * Clubs an admin can pick from, for the slot form.
 *
 * Not `listClubs`: the directory returns a `ClubSummary`, which deliberately
 * carries no id because nothing public addresses a club by one. Booking a slot
 * does, so this asks for the two columns it needs rather than widening a type
 * forty components read.
 */
export async function findClubsForPicker(): Promise<
  { id: number; name: string; city: string }[]
> {
  const rows = await table<{ id: number; name: string; city: string }>("clubs");
  const { data, error } = await rows
    .select("id, name, city")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(500);

  if (error) throw new Error(`Failed to load the clubs: ${error.message}`);
  return data ?? [];
}
