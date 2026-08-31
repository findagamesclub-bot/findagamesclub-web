import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

export type MembershipRow = Tables<"club_memberships">;

const COLUMNS =
  "id, club_id, profile_id, status, tier_key, tier_assigned_at, created_at, reviewed_at, joined_at, decline_reason";

/** The viewer's own membership of one club, whatever its state. */
export async function findMyMembership(clubId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(COLUMNS)
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    // A cancelled row survives alongside a fresh application, so take the newest.
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load membership: ${error.message}`);
  return (data as MembershipRow | null) ?? null;
}

/**
 * Everyone in a club, with their profile joined in one query.
 *
 * The legacy endpoint looped every member and fetched each profile separately,
 * which is roughly eighty round trips on Didcot's roster.
 */
export async function findClubMemberships(clubId: number, statuses: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select(
      `${COLUMNS}, profiles!club_memberships_profile_id_fkey(id, full_name, games_interested, factions_armies, play_style_tags)`,
    )
    .eq("club_id", clubId)
    .in("status", statuses)
    .order("joined_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load club members: ${error.message}`);
  return data ?? [];
}

export async function insertMembershipRequest(
  clubId: number,
  profileId: string,
  tierKey: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_memberships")
    .insert({ club_id: clubId, profile_id: profileId, status: "pending", tier_key: tierKey });

  if (error) throw new Error(error.message);
}

type Decision = {
  status: "approved" | "cancelled";
  reviewedBy: string;
  declineReason?: string | null;
  joinedAt?: string | null;
  /**
   * Only act on a row still in one of these states. Without it the id alone
   * decides, and an owner working from a queue that loaded a minute ago can
   * approve a request the applicant already withdrew, or cancel a member who
   * was approved in between.
   */
  from: string[];
};

/**
 * Approve, decline or cancel. The policies decide who is allowed to.
 *
 * Returns the row it changed. An UPDATE that RLS filters out affects zero rows
 * and reports NO error — PostgREST answers 204. Treating that as success is
 * what let a non-owner reach the notification code and mail another member, so
 * every write here has to prove it actually touched something.
 */
export async function updateMembership(id: number, decision: Decision) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .update({
      status: decision.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: decision.reviewedBy,
      decline_reason: decision.declineReason ?? null,
      joined_at: decision.joinedAt ?? null,
      tier_assigned_at: decision.joinedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", decision.from)
    .select("id, club_id, profile_id, tier_key")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The member leaving of their own accord. Policy pins the result to cancelled. */
export async function cancelOwnMembership(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "approved"])
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * How many times this person has applied to this club recently.
 *
 * Re-applying is allowed by design, which means join/withdraw/join is an
 * unbounded mail loop aimed at the owner. This is the brake.
 */
export async function countRecentRequests(clubId: number, profileId: string, sinceIso: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_memberships")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .gte("created_at", sinceIso);

  if (error) throw new Error(`Failed to check recent requests: ${error.message}`);
  return count ?? 0;
}

/** Approved-member counts for a set of clubs, for the directory card. */
export async function countApprovedByClub(clubIds: number[]) {
  if (clubIds.length === 0) return new Map<number, number>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select("club_id")
    .in("club_id", clubIds)
    .eq("status", "approved");

  if (error) throw new Error(`Failed to count members: ${error.message}`);

  const counts = new Map<number, number>();
  for (const row of data ?? []) counts.set(row.club_id, (counts.get(row.club_id) ?? 0) + 1);
  return counts;
}

/** Valid tier keys for a club, used to check what a join form sent. */
export async function findTierKeys(clubId: number): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers")
    .select("tier_key")
    .eq("club_id", clubId);

  if (error) throw new Error(`Failed to load tiers: ${error.message}`);
  return (data ?? []).map((t) => t.tier_key);
}

/** Just enough club to address an email, without the full detail query. */
export async function findClubBasics(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, owner_id")
    .eq("id", clubId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load club: ${error.message}`);
  return data;
}

/** A tier's display label, for "approved on Premium". */
export async function findTierLabel(clubId: number, tierKey: string | null) {
  if (!tierKey) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_membership_tiers")
    .select("label")
    .eq("club_id", clubId)
    .eq("tier_key", tierKey)
    .maybeSingle();

  return data?.label ?? null;
}

/**
 * One membership by id, for the payment flow.
 *
 * The SELECT policy is wider than the write policies, so a row coming back
 * here proves nothing about the caller's rights — an approved member can read
 * their clubmates. It is only safe to build on because the payment INSERT that
 * follows is gated on can_manage_club and sends no email. Do not reuse this to
 * decide whether an action is allowed.
 */
export async function findMembershipForPayment(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select("id, club_id, profile_id, status, tier_key, tier_assigned_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load membership: ${error.message}`);
  return data;
}

/** Set a member's tier. Approved members only — a pending row keeps what they asked for. */
/**
 * Tier requests outstanding at a club, by membership id.
 *
 * A second query rather than two more columns on the roster select: those
 * columns arrived in 0025 and `database.ts` does not know them until the types
 * are regenerated. Delete this narrowing then, and fold the columns in.
 */
export async function findTierRequests(clubId: number) {
  const supabase = await createClient();
  type Row = { id: number; requested_tier_key: string | null; tier_requested_at: string | null };
  type Chain = {
    select(columns: string): Chain;
    eq(column: string, value: number): Chain;
    not(column: string, op: string, value: null): Promise<
      { data: Row[] | null; error: { message: string } | null }
    >;
  };

  const { data, error } = await (supabase as unknown as { from(name: string): Chain })
    .from("club_memberships")
    .select("id, requested_tier_key, tier_requested_at")
    .eq("club_id", clubId)
    .not("requested_tier_key", "is", null);

  if (error) throw new Error(`Failed to load tier requests: ${error.message}`);
  return data ?? [];
}

/** Clear a request once the club has decided, either way. See 0026. */
export async function clearTierRequest(membershipId: number) {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc("resolve_tier_request", { membership: membershipId });

  if (error) throw new Error(error.message);
}

export async function setMembershipTier(id: number, tierKey: string, reviewedBy: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    // Stamping the moment of assignment is what lets standing() ignore money
    // paid toward the tier they just left.
    .update({
      tier_key: tierKey,
      tier_assigned_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * How many people have joined this club, for anybody to see.
 *
 * The roster is members-only by RLS, so the ordinary client counts zero for a
 * visitor. Legacy has no such problem and publishes the figure to everyone
 * (`approvedMemberCount`, club_store.py:1486), so this reads past RLS with the
 * service role.
 *
 * Deliberately narrow: it selects no columns and returns an integer, so the
 * privileged client can never hand a caller somebody's membership row. Any
 * change here should keep `head: true`.
 */
export async function countApprovedPublic(clubId: number): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("club_memberships")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "approved");

  if (error) throw new Error(`Failed to count members: ${error.message}`);
  return count ?? 0;
}

/**
 * Joined counts for a page of clubs, for anybody to see.
 *
 * The single-club version in one query rather than one per card. Same reason
 * for the privileged client: RLS would answer zero for a visitor, and legacy
 * publishes this figure to everyone.
 */
export async function countApprovedPublicByClub(clubIds: number[]) {
  const counts = new Map<number, number>();
  if (!clubIds.length) return counts;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("club_memberships")
    // club_id only: enough to count by, and nothing that identifies a member.
    .select("club_id")
    .in("club_id", clubIds)
    .eq("status", "approved");

  if (error) throw new Error(`Failed to count members: ${error.message}`);
  for (const row of data ?? []) counts.set(row.club_id, (counts.get(row.club_id) ?? 0) + 1);
  return counts;
}
