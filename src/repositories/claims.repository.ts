import "server-only";

import { callRpc, table } from "@/lib/supabase/table";

/** Claims on a listing somebody says is theirs. */

export type ClaimRow = {
  id: number;
  club_id: number;
  claimant_id: string;
  status: string;
  message: string;
  evidence: string;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
  club?: { slug: string; name: string; city: string } | null;
  claimant?: { full_name: string | null } | null;
};

const COLUMNS =
  `id, club_id, claimant_id, status, message, evidence, decided_at,
   decision_note, created_at,
   club:clubs(slug, name, city), claimant:profiles!claimant_id(full_name)`;

export async function findClaimsPage(params: {
  status: string; from: number; to: number;
}): Promise<{ rows: ClaimRow[]; total: number }> {
  const rows = await table<ClaimRow>("club_claims");
  let query = rows.select(COLUMNS, { count: "exact" });
  if (params.status !== "all") query = query.eq("status", params.status);

  // Oldest first, which is the only order fair to somebody who asked three
  // weeks ago. The same reasoning the submissions queue uses.
  const { data, error, count } = await query
    .order("created_at", { ascending: true })
    .range(params.from, params.to);

  if (error) throw new Error(`Failed to load the claims: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function countClaimsByStatus(keys: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  await Promise.all(keys.map(async (key) => {
    const rows = await table<ClaimRow>("club_claims");
    let query = rows.select("id", { count: "exact" });
    if (key !== "all") query = query.eq("status", key);
    const { count } = await query.range(0, 0);
    counts.set(key, count ?? 0);
  }));

  return counts;
}

export async function findClaim(id: number): Promise<ClaimRow | null> {
  const rows = await table<ClaimRow>("club_claims");
  const { data, error } = await rows.select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load that claim: ${error.message}`);
  return data;
}

/** Whether this person already has one in on this club. */
export async function findMyClaim(clubId: number): Promise<ClaimRow | null> {
  const rows = await table<ClaimRow>("club_claims");
  const { data, error } = await rows
    .select(COLUMNS)
    .eq("club_id", clubId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load your claim: ${error.message}`);
  return data;
}

/**
 * Every claim this person has in, newest first.
 *
 * RLS already limits the rows to their own, so there is no claimant filter
 * here: the policy is the filter, and a second one in the query would be a
 * second place to get it wrong.
 */
export async function findMyClaims(): Promise<ClaimRow[]> {
  const rows = await table<ClaimRow>("club_claims");
  const { data, error } = await rows
    .select(COLUMNS)
    .order("id", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to load your claims: ${error.message}`);
  return data ?? [];
}

/**
 * Put one in.
 *
 * An ordinary insert rather than a function: the policy already refuses a club
 * that is not open to claims, and the unique index already refuses a second
 * open one. A function would only repeat both.
 */
export async function startClaim(params: {
  clubId: number; message: string; evidence: string;
}): Promise<ClaimRow> {
  const rows = await table<ClaimRow>("club_claims");
  const { data, error } = await rows
    .insert({
      club_id: params.clubId,
      message: params.message,
      evidence: params.evidence,
    })
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The claimant's one move, through the policy rather than a function. */
export async function withdrawClaim(id: number): Promise<ClaimRow> {
  const rows = await table<ClaimRow>("club_claims");
  const { data, error } = await rows
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("status", "open")
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export const approveClaim = (id: number, note: string) =>
  callRpc<{ club_id: number; slug: string; name: string }>(
    "approve_club_claim", { p_claim: id, p_note: note });

export const declineClaim = (id: number, note: string) =>
  callRpc<string>("decline_club_claim", { p_claim: id, p_note: note });

export const setClaimable = (club: number, claimable: boolean) =>
  callRpc<boolean>("admin_set_club_claimable", { p_club: club, p_claimable: claimable });

export const createClubAsAdmin = (name: string, city: string, claimable: boolean) =>
  callRpc<{ club_id: number; slug: string; name: string }>(
    "admin_create_club", { p_name: name, p_city: city, p_claimable: claimable });

/**
 * Clubs an admin can open to claims.
 *
 * Ownerless only: `admin_set_club_claimable` refuses a club that already has
 * somebody, so offering one would be offering a refusal. `claimable` comes back
 * so the screen can separate the ones already open from the rest.
 */
export async function findOwnerlessClubs(): Promise<
  { id: number; name: string; city: string; claimable: boolean }[]
> {
  const rows = await table<{
    id: number; name: string; city: string; claimable: boolean;
  }>("clubs");
  const { data, error } = await rows
    .select("id, name, city, claimable")
    .is("owner_id", null)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(1000);

  if (error) throw new Error(`Failed to load the clubs: ${error.message}`);
  return data ?? [];
}
