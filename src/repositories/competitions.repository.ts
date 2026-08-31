import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StandingRow = {
  rank: number; member_name: string; profile_id: string | null;
  played: number; wins: number; draws: number; losses: number; points: number;
  record_label: string; notes: string; faction: string; detachment: string;
};

export type UpdateRow = {
  id: number; posted_on: string | null; title: string; summary: string; position: number;
  club_competition_matches: {
    player_one: string; player_one_score: string;
    player_two: string; player_two_score: string; position: number;
  }[];
};

export type CompetitionRow = {
  id: number; title: string; type: string; type_label: string;
  status: string; status_label: string; season: string; game: string;
  summary: string; start_date: string | null; end_date: string | null; position: number;
  club_competition_standings: StandingRow[];
  club_competition_updates?: UpdateRow[];
};

/**
 * `src/types/database.ts` is generated from the live schema and does not know
 * these tables until the types are regenerated against 0024. Same temporary
 * narrowing as eventAlerts; delete this block once they exist.
 */
type Result = {
  data: CompetitionRow[] | null;
  count: number | null;
  error: { message: string } | null;
};

// Split rather than one chainable type: a builder that is itself thenable gets
// flattened by `await`, which quietly turns the query object into its result.
type ListBuilder = {
  eq(column: string, value: string | number): ListBuilder;
  in(column: string, values: readonly string[]): ListBuilder;
  order(column: string, options: { ascending: boolean }): ListBuilder;
  range(from: number, to: number): Promise<Result>;
};

type CountBuilder = Promise<Result> & {
  eq(column: string, value: string | number): CountBuilder;
  in(column: string, values: readonly string[]): CountBuilder;
};

type Root = {
  select(columns: string): ListBuilder;
  select(columns: string, options: { count: "exact"; head: true }): CountBuilder;
};

const STANDINGS = `
  club_competition_standings(
    rank, member_name, profile_id, played, wins, draws, losses, points,
    record_label, notes, faction, detachment
  )`;

const HISTORY = `
  club_competition_updates(
    id, posted_on, title, summary, position,
    club_competition_matches(
      player_one, player_one_score, player_two, player_two_score, position
    )
  )`;

const HEAD = `
  id, title, type, type_label, status, status_label, season, game, summary,
  start_date, end_date, position`;

async function table(): Promise<Root> {
  const supabase = await createClient();
  return (supabase as unknown as { from(name: string): Root })
    .from("club_competitions");
}

/**
 * A page of a club's competitions.
 *
 * History is opt-in because it is the expensive half: every round of every
 * competition, with every match inside it. The club page never shows it, so it
 * never asks for it.
 */
export async function findPage(
  clubId: number,
  { status, from = 0, to = 5, withHistory = false }:
  { status?: string; from?: number; to?: number; withHistory?: boolean },
) {
  let query = (await table())
    .select(withHistory ? `${HEAD},${STANDINGS},${HISTORY}` : `${HEAD},${STANDINGS}`)
    .eq("club_id", clubId);

  // "Running now" covers upcoming as well as active. The public page has two
  // tabs and the club can set three states, so without this an Upcoming
  // competition sits in the owner's list and appears nowhere at all.
  if (status === "active") query = query.in("status", ["upcoming", "active"]);
  else if (status) query = query.eq("status", status);

  // Newest first by the date it started; position breaks ties, so an owner's
  // own ordering still decides between two competitions that began together.
  const { data, error } = await query
    .order("start_date", { ascending: false })
    .order("position", { ascending: true })
    .range(from, to);

  if (error) throw new Error(`Failed to load competitions: ${error.message}`);
  return data ?? [];
}

/** How many, without reading a single row of them. */
export async function countByStatus(clubId: number, status: string) {
  const base = (await table())
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);

  // Same grouping as findPage, or the tab count and the tab disagree.
  const { count, error } = await (status === "active"
    ? base.in("status", ["upcoming", "active"])
    : base.eq("status", status));

  if (error) throw new Error(`Failed to count competitions: ${error.message}`);
  return count ?? 0;
}

// --- writes ----------------------------------------------------------------
//
// The competition tables are not in the generated types yet, so the client is
// narrowed by hand here as it is for the reads above. The chain type is
// deliberately NOT thenable: a shim that extends PromiseLike gets flattened by
// `await` and the builder turns into its own result, which this codebase has
// paid for three times. Every call ends in select().rows() or
// select().one(), both of which are the only promises in the chain.

type Fail = { message: string; code?: string } | null;

type Rows = {
  rows(): Promise<{ data: { id: number }[] | null; error: Fail }>;
  one(): Promise<{ data: { id: number } | null; error: Fail }>;
};

type Chain = {
  eq(column: string, value: unknown): Chain;
  select(columns: string): Rows;
};

type Writable = {
  insert(values: unknown): Chain;
  update(values: unknown): Chain;
  delete(): Chain;
};

async function writable(name: string): Promise<Writable> {
  const supabase = await createClient();
  const from = (supabase as unknown as { from(n: string): unknown }).from(name);

  const wrap = (builder: unknown): Chain => ({
    eq: (column, value) =>
      wrap((builder as { eq(c: string, v: unknown): unknown }).eq(column, value)),
    select: (columns) => {
      const selected = (builder as { select(c: string): unknown }).select(columns);
      return {
        rows: () => selected as Promise<{ data: { id: number }[] | null; error: Fail }>,
        one: () => (selected as { maybeSingle(): Promise<{ data: { id: number } | null; error: Fail }> })
          .maybeSingle(),
      };
    },
  });

  return {
    insert: (values) => wrap((from as { insert(v: unknown): unknown }).insert(values)),
    update: (values) => wrap((from as { update(v: unknown): unknown }).update(values)),
    delete: () => wrap((from as { delete(): unknown }).delete()),
  };
}
//
// Every one of these is gated by the manage policies from 0024, so a member
// reaching them gets zero rows rather than an error. Each write proves it
// touched something, per the zero-row trap in CLAUDE.md.

export type CompetitionInput = {
  title: string;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  season: string;
  game: string;
  summary: string;
  startDate: string | null;
  endDate: string | null;
};

export async function insertCompetition(clubId: number, input: CompetitionInput) {
  const { data, error } = await (await writable("club_competitions"))
    .insert({
      club_id: clubId,
      title: input.title, type: input.type, type_label: input.typeLabel,
      status: input.status, status_label: input.statusLabel,
      season: input.season, game: input.game, summary: input.summary,
      start_date: input.startDate, end_date: input.endDate,
    })
    .select("id").one();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function updateCompetition(id: number, input: CompetitionInput) {
  const { data, error } = await (await writable("club_competitions"))
    .update({
      title: input.title, type: input.type, type_label: input.typeLabel,
      status: input.status, status_label: input.statusLabel,
      season: input.season, game: input.game, summary: input.summary,
      start_date: input.startDate, end_date: input.endDate,
    })
    .eq("id", id)
    .select("id").one();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function deleteCompetition(id: number) {
  const { data, error } = await (await writable("club_competitions"))
    .delete()
    .eq("id", id)
    .select("id").one();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/**
 * The whole table at once.
 *
 * A league table is edited as a unit: rows are added, removed and reordered
 * together, and ranks are positions in a list rather than values anybody types.
 * Replacing it is one round trip and cannot leave two rows claiming third.
 */
export async function replaceStandings(
  competitionId: number,
  rows: Omit<StandingRow, "record_label">[],
) {
  const standings = await writable("club_competition_standings");

  const { error: cleared } = await standings
    .delete()
    .eq("competition_id", competitionId)
    .select("id").rows();
  if (cleared) throw new Error(cleared.message);

  if (!rows.length) return;

  const { error } = await standings.insert(
    rows.map((row, index) => ({
      competition_id: competitionId,
      rank: index + 1,
      member_name: row.member_name,
      profile_id: row.profile_id,
      played: row.played, wins: row.wins, draws: row.draws, losses: row.losses,
      points: row.points,
      // Kept in step with the numbers rather than typed: legacy shows "3-1-1"
      // beside the row and a hand-typed one drifts the moment a game is added.
      record_label: `${row.wins}-${row.draws}-${row.losses}`,
      notes: row.notes, faction: row.faction, detachment: row.detachment,
    })),
  ).select("id").rows();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function insertRound(competitionId: number, input: {
  postedOn: string | null; title: string; summary: string; position: number;
}) {
  const { data, error } = await (await writable("club_competition_updates"))
    .insert({
      competition_id: competitionId,
      posted_on: input.postedOn, title: input.title,
      summary: input.summary, position: input.position,
    })
    .select("id").one();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

export async function updateRound(id: number, input: {
  postedOn: string | null; title: string; summary: string;
}) {
  const { data, error } = await (await writable("club_competition_updates"))
    .update({ posted_on: input.postedOn, title: input.title, summary: input.summary })
    .eq("id", id)
    .select("id").one();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
}

export async function deleteRound(id: number) {
  const { data, error } = await (await writable("club_competition_updates"))
    .delete()
    .eq("id", id)
    .select("id").one();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/** Same reasoning as the standings: a round's matches are edited as a set. */
export async function replaceMatches(updateId: number, rows: {
  playerOne: string; playerOneScore: string;
  playerTwo: string; playerTwoScore: string;
}[]) {
  const matches = await writable("club_competition_matches");

  const { error: cleared } = await matches
    .delete()
    .eq("update_id", updateId)
    .select("id").rows();
  if (cleared) throw new Error(cleared.message);

  if (!rows.length) return;

  const { error } = await matches.insert(
    rows.map((row, index) => ({
      update_id: updateId,
      player_one: row.playerOne, player_one_score: row.playerOneScore,
      player_two: row.playerTwo, player_two_score: row.playerTwoScore,
      position: index,
    })),
  ).select("id").rows();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}
