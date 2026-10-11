import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import type { EventTeam, TeamFixture, TeamTable } from "@/types/eventTeams";

/**
 * Teams and their fixtures.
 *
 * Both reads go through a function rather than a select, because every column
 * here arrived in 0168 and `src/types/database.ts` has been stale since 0151,
 * which is what `npm run check:columns` is there to notice. The writes are
 * ordinary: the column grants and 0168's policies decide them, the same as
 * every other part of the draw.
 */

type TeamRow = {
  id: number; name: string; position: number;
  final_rank: number | null; placement: string | null;
  captain_profile_id: string | null;
  players: { id: number; profileId: string | null; name: string; position: number }[] | null;
};

type FixtureRow = {
  id: number; pairing_id: number; round: number | null; table_label: string | null;
  team_one: number | null; team_one_name: string | null;
  team_two: number | null; team_two_name: string | null;
  score_one: number | null; score_two: number | null;
  games_one: number; games_two: number;
  points_one: number | null; points_two: number | null;
  position: number; published: boolean;
  tables: TeamTable[] | null;
};

const text = (value: string | null | undefined) => value ?? "";

export async function findTeams(eventId: number): Promise<EventTeam[]> {
  const rows = await callRpc<TeamRow[]>("event_teams", { p_event: eventId });
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: text(row.name),
    position: row.position,
    finalRank: row.final_rank,
    placement: text(row.placement),
    captainProfileId: row.captain_profile_id,
    players: row.players ?? [],
  }));
}

export async function findTeamDraw(eventId: number): Promise<TeamFixture[]> {
  const rows = await callRpc<FixtureRow[]>("event_team_draw", { p_event: eventId });
  return (rows ?? []).map((row) => ({
    id: row.id,
    pairingId: row.pairing_id,
    round: row.round ?? 0,
    tableLabel: text(row.table_label),
    teamOne: row.team_one,
    teamOneName: text(row.team_one_name),
    teamTwo: row.team_two,
    teamTwoName: text(row.team_two_name),
    scoreOne: row.score_one,
    scoreTwo: row.score_two,
    gamesOne: row.games_one,
    gamesTwo: row.games_two,
    pointsOne: row.points_one,
    pointsTwo: row.points_two,
    position: row.position,
    published: row.published,
    tables: row.tables ?? [],
  }));
}

/**
 * The club's own score for one fixture, or null to go back to the players'
 * total. Through a function because the guard is the club's (0176).
 */
export const saveTeamMatchPoints = (
  matchId: number, one: number | null, two: number | null,
) => callRpc<null>("set_team_match_points",
  { p_match: matchId, p_one: one, p_two: two });

/** Whether this event runs as teams, through a function for the reason above. */
export const findTeamEvent = (eventId: number) =>
  callRpc<boolean>("event_is_team_event", { p_event: eventId });

export async function setTeamEvent(eventId: number, on: boolean) {
  const events = await table<{ id: number }>("club_events");
  const { data, error } = await events
    .update({ team_event: on }).eq("id", eventId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/**
 * A team and its players, in one transaction.
 *
 * Through a function rather than four round trips: the players are replaced
 * wholesale, and a delete followed by an insert that fails would take a team's
 * players away and leave them away. 0168 has the whole argument.
 */
export const saveTeam = (params: {
  eventId: number; teamId: number | null; name: string;
  captainProfileId: string | null; position: number;
  players: { profileId: string | null; name: string }[];
}) => callRpc<number>("save_event_team", {
  p_event: params.eventId,
  p_team: params.teamId,
  p_name: params.name,
  p_captain: params.captainProfileId,
  p_position: params.position,
  p_players: params.players,
});

/** Where the club says a team finished. An ordinary update by policy. */
export async function placeTeam(
  eventId: number, id: number, fields: { final_rank: number | null; placement: string },
) {
  const teams = await table<{ id: number }>("club_event_teams");
  const { data, error } = await teams
    .update(fields).eq("id", id).eq("event_id", eventId)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

export async function deleteTeam(eventId: number, id: number) {
  const teams = await table<{ id: number }>("club_event_teams");
  const { error } = await teams.delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export type FixtureFields = {
  table_label: string;
  team_one: number | null;
  team_two: number | null;
  position: number;
};

export async function insertFixture(
  pairingId: number, eventId: number, fields: FixtureFields,
): Promise<number> {
  const fixtures = await table<{ id: number }>("club_event_team_matches");
  const { data, error } = await fixtures
    .insert({ pairing_id: pairingId, event_id: eventId, ...fields })
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data.id;
}

export async function deleteFixture(eventId: number, id: number) {
  const fixtures = await table<{ id: number }>("club_event_team_matches");
  const { error } = await fixtures.delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/** Every fixture in one round, for a redraw. */
export async function clearRoundFixtures(pairingId: number) {
  const fixtures = await table<{ id: number }>("club_event_team_matches");
  const { error } = await fixtures.delete().eq("pairing_id", pairingId);
  if (error) throw new Error(error.message);
}
