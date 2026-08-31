import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StandingRow = {
  id: number;
  member_name: string;
  profile_id: string | null;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  record_label: string;
  club_competitions: {
    id: number; club_id: number; title: string; type: string;
    type_label: string; status: string; season: string;
    clubs: { slug: string; name: string };
  };
};

export type ResultRow = {
  id: number;
  member_name: string;
  member_profile_id: string | null;
  rank: number;
  placement: string;
  club_events: {
    id: number; club_id: number; legacy_id: string; title: string;
    start_date: string | null;
    clubs: { slug: string; name: string };
  };
};

/**
 * `src/types/database.ts` predates the competition tables. Same temporary
 * narrowing as elsewhere; delete once the types are regenerated.
 */
type Chain<T> = {
  select(columns: string): Chain<T>;
  eq(column: string, value: string | number): Chain<T>;
  is(column: string, value: null): Chain<T>;
  not(column: string, op: string, value: null): Chain<T>;
  order(column: string, options: { ascending: boolean }): Promise<
    { data: T[] | null; error: { message: string } | null }
  >;
};

const STANDING_COLUMNS = `
  id, member_name, profile_id, rank, played, wins, draws, losses, points,
  record_label,
  club_competitions!inner(id, club_id, title, type, type_label, status, season,
    clubs!inner(slug, name))`;

const RESULT_COLUMNS = `
  id, member_name, member_profile_id, rank, placement,
  club_events!inner(id, club_id, legacy_id, title, start_date,
    clubs!inner(slug, name))`;

const table = async <T>(name: string) => {
  const supabase = await createClient();
  return (supabase as unknown as { from(n: string): Chain<T> }).from(name);
};

/** Every competition this member has been placed in, at any club. */
export async function findStandingsFor(profileId: string) {
  const { data, error } = await (await table<StandingRow>("club_competition_standings"))
    .select(STANDING_COLUMNS)
    .eq("profile_id", profileId)
    .order("rank", { ascending: true });

  if (error) throw new Error(`Failed to load their record: ${error.message}`);
  return data ?? [];
}

/** Podium finishes at events. */
export async function findResultsFor(profileId: string) {
  const { data, error } = await (await table<ResultRow>("club_event_results"))
    .select(RESULT_COLUMNS)
    .eq("member_profile_id", profileId)
    .order("rank", { ascending: true });

  if (error) throw new Error(`Failed to load their results: ${error.message}`);
  return data ?? [];
}

/** Names at this club that nobody has said belong to an account yet. */
export async function findUnlinkedStandings(clubId: number) {
  const { data, error } = await (await table<StandingRow>("club_competition_standings"))
    .select(STANDING_COLUMNS)
    .eq("club_competitions.club_id", clubId)
    .is("profile_id", null)
    .order("member_name", { ascending: true });

  if (error) throw new Error(`Failed to load standings: ${error.message}`);
  return data ?? [];
}

export async function findUnlinkedResults(clubId: number) {
  const { data, error } = await (await table<ResultRow>("club_event_results"))
    .select(RESULT_COLUMNS)
    .eq("club_events.club_id", clubId)
    .is("member_profile_id", null)
    .order("member_name", { ascending: true });

  if (error) throw new Error(`Failed to load results: ${error.message}`);
  return data ?? [];
}

/** Names at this club that somebody has already been put against. */
export async function findLinkedStandings(clubId: number) {
  const { data, error } = await (await table<StandingRow>("club_competition_standings"))
    .select(STANDING_COLUMNS)
    .eq("club_competitions.club_id", clubId)
    .not("profile_id", "is", null)
    .order("member_name", { ascending: true });

  if (error) throw new Error(`Failed to load standings: ${error.message}`);
  return data ?? [];
}

export async function findLinkedResults(clubId: number) {
  const { data, error } = await (await table<ResultRow>("club_event_results"))
    .select(RESULT_COLUMNS)
    .eq("club_events.club_id", clubId)
    .not("member_profile_id", "is", null)
    .order("member_name", { ascending: true });

  if (error) throw new Error(`Failed to load results: ${error.message}`);
  return data ?? [];
}

const rpc = async (name: string, args: Record<string, unknown>) => {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc(name, args);
  if (error) throw new Error(error.message);
};

export const linkStanding = (standingId: number, profileId: string | null) =>
  rpc("link_standing_member", { p_standing: standingId, p_profile: profileId });

export const linkResult = (resultId: number, profileId: string | null) =>
  rpc("link_event_result_member", { p_result: resultId, p_profile: profileId });
