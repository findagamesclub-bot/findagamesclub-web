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
 * One club's own slots, for its billing page.
 *
 * An ordinary select rather than a function: 0113's policy is `using (true)`,
 * because what is featured is on the front page anyway, and every column here
 * is in the generated types, so `check:columns` can see this one.
 *
 * Nothing is filtered by date. The club asked for past, live and to come, and
 * that is one list read three ways rather than three round trips for three
 * groups of the same rows.
 */
export type ClubSlotRow = {
  id: number;
  starts_on: string;
  ends_on: string;
  price_pence: number;
  currency: string;
  note: string;
};

export async function findSlotsForClub(clubId: number): Promise<ClubSlotRow[]> {
  const rows = await table<ClubSlotRow>("featured_listings");
  const { data, error } = await rows
    .select("id, starts_on, ends_on, price_pence, currency, note")
    .eq("club_id", clubId)
    .order("starts_on", { ascending: true })
    // A club holding more than this has a history nobody reads to the end of,
    // and the panel caps what it draws anyway.
    .limit(60);

  if (error) throw new Error(`Failed to load this club's slots: ${error.message}`);
  return data ?? [];
}

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

/**
 * Which clubs hold a live, paid slot today.
 *
 * Its own read rather than `featured_clubs()`, because that one answers a
 * different question: who should lead the homepage, capped at six and padded
 * with `spotlight` when nothing has been sold. This is the narrower fact that
 * the badge depends on, uncapped and with nothing standing in.
 *
 * The anon client, like `findFeaturedClubs`: the directory caches this and
 * `unstable_cache` cannot contain `cookies()`. RLS still applies, and 0113's
 * own policy is `using (true)` because what is featured today is on the front
 * page anyway.
 */
export async function findLiveFeaturedClubIds(today: string): Promise<number[]> {
  const supabase = createAnonClient();
  const { data, error } = await (supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        lte(column: string, value: string): {
          gte(column: string, value: string): Promise<{
            data: { club_id: number }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .from("featured_listings")
    .select("club_id")
    .lte("starts_on", today)
    .gte("ends_on", today);

  if (error) throw new Error(`Failed to load the live featured slots: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.club_id))];
}
