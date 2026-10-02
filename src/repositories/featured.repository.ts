import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * One slot and the club behind it.
 *
 * Read before a removal, never after: the row is gone by the time the email
 * is written, and the owner's address is on the club rather than the slot.
 */
export type SlotClubRow = {
  id: number;
  starts_on: string;
  ends_on: string;
  price_pence: number;
  club?: { slug: string; name: string; owner_id: string | null } | null;
};

export async function findSlot(id: number): Promise<SlotClubRow | null> {
  const rows = await table<SlotClubRow>("featured_listings");
  const { data, error } = await rows
    .select("id, starts_on, ends_on, price_pence, club:clubs(slug, name, owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to read the slot: ${error.message}`);
  return data ?? null;
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

/**
 * The slots that finished without anybody being told, and the stamp that stops
 * a second run writing twice.
 *
 * Read as the job, like the billing cron's own reads: going through an
 * ordinary session meant an unreadable table came back as "nothing due", and a
 * no-op that looks like a decision is the worst kind of silence.
 */
export type EndedSlotRow = {
  slot_id: number;
  club_id: number;
  owner_id: string | null;
  club_name: string;
  club_slug: string;
  starts_on: string;
  ends_on: string;
  price_pence: number;
};

export async function findEndedSlotsAsJob(): Promise<EndedSlotRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("featured_slots_just_ended" as never, {} as never);
  if (error) throw new Error(`Failed to ask which slots ended: ${error.message}`);
  return (data ?? []) as EndedSlotRow[];
}

/** False when somebody else already announced it, so nothing should be sent. */
export async function markFeaturedAnnouncedAsJob(slot: number): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("mark_featured_announced" as never, { p_slot: slot } as never);
  if (error) throw new Error(`Failed to mark a slot announced: ${error.message}`);
  return Boolean(data);
}
