import "server-only";

import { callRpc, table } from "@/lib/supabase/table";
import type { PairingMatch, PairingRound } from "@/types/eventEditor";

/**
 * The draw, as rows.
 *
 * Until 0091 a round was one `matches` jsonb blob, so editing one table
 * rewrote the whole round: two people entering scores at the same tournament
 * overwrote each other, and nothing could point at a single match.
 */

type RoundRow = {
  id: number;
  event_id: number;
  round: number | null;
  label: string | null;
  published: boolean;
};

type MatchRow = {
  id: number;
  pairing_id: number;
  table_label: string | null;
  player_one: string | null;
  player_one_id: string | null;
  player_two: string | null;
  player_two_id: string | null;
  score_one: number | null;
  score_two: number | null;
  /** 0183. What the format counts a table at, beside the victory points. */
  points_one?: number | null;
  points_two?: number | null;
  position: number;
};

const text = (value: string | null | undefined) => value ?? "";

export async function findRounds(eventId: number): Promise<PairingRound[]> {
  const rounds = await table<RoundRow>("club_event_pairings");
  const { data, error } = await rounds
    .select("id, event_id, round, label, published").eq("event_id", eventId).order("round");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) return [];

  const matches = await table<MatchRow>("club_event_pairing_matches");
  const { data: played, error: matchError } = await matches
    .select(`id, pairing_id, table_label, player_one, player_one_id,
             player_two, player_two_id, score_one, score_two, position`)
    .in("pairing_id", rows.map((row) => row.id))
    .order("position");
  if (matchError) throw new Error(matchError.message);

  const byRound = new Map<number, PairingMatch[]>();
  for (const row of played ?? []) {
    const list = byRound.get(row.pairing_id) ?? [];
    list.push({
      id: row.id,
      tableLabel: text(row.table_label),
      playerOne: text(row.player_one),
      playerOneId: row.player_one_id,
      playerTwo: text(row.player_two),
      playerTwoId: row.player_two_id,
      scoreOne: row.score_one,
      scoreTwo: row.score_two,
      // Only a team event scores a table twice, and those tables come back
      // through `event_team_draw` with both pairs on them. This read is the
      // ordinary draw, and naming the 0183 columns here would fail
      // `check:columns` against the stale `database.ts` besides.
      pointsOne: null,
      pointsTwo: null,
      position: row.position,
    });
    byRound.set(row.pairing_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    round: row.round ?? 0,
    label: text(row.label),
    published: row.published,
    matches: byRound.get(row.id) ?? [],
  }));
}

/**
 * Who a published round reaches.
 *
 * Through a function rather than a select because `draw_public` arrived in
 * 0163 and `src/types/database.ts` has not been regenerated since 0151, which
 * is what `npm run check:columns` is there to notice. The write is an ordinary
 * update: the column grant and 0090's policy decide it, the same as every
 * other field on an event.
 */
export const findDrawPublic = (eventId: number) =>
  callRpc<boolean>("event_draw_public", { p_event: eventId });

/** Whether a round has been published at all, without reading one. */
export const findHasDraw = (eventId: number) =>
  callRpc<boolean>("event_has_draw", { p_event: eventId });

export async function setDrawPublic(eventId: number, open: boolean) {
  const events = await table<{ id: number }>("club_events");
  const { data, error } = await events
    .update({ draw_public: open }).eq("id", eventId)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/**
 * The round row, made if it is not there yet.
 *
 * A unique index covers `(event_id, round)`, so two people building round two
 * at once cannot end up with two round twos: the loser gets 23505 and reads
 * the row that won.
 */
export async function ensureRound(
  eventId: number, round: number, label: string,
): Promise<number> {
  const rounds = await table<RoundRow>("club_event_pairings");

  const { data: seen, error: readError } = await rounds
    .select("id").eq("event_id", eventId).eq("round", round).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (seen) return seen.id;

  const { data, error } = await rounds
    .insert({ event_id: eventId, round, label, published: false })
    .select("id").maybeSingle();

  if (error) {
    if (!error.message.includes("23505") && !error.message.includes("one_per_round")) {
      throw new Error(error.message);
    }
    const { data: raced, error: raceError } = await rounds
      .select("id").eq("event_id", eventId).eq("round", round).maybeSingle();
    if (raceError) throw new Error(raceError.message);
    if (!raced) throw new Error("That round did not save. Try again.");
    return raced.id;
  }

  if (!data) throw new Error("NOT_PERMITTED");
  return data.id;
}

export type MatchFields = {
  /** 0183. What the format counts a table at, beside the victory points. */
  points_one?: number | null;
  points_two?: number | null;
  table_label: string;
  player_one: string;
  player_one_id: string | null;
  player_two: string;
  player_two_id: string | null;
  score_one: number | null;
  score_two: number | null;
  position: number;
  /**
   * The fixture this table belongs to at a team event (0168). Absent on an
   * ordinary draw, which is every event that is not run as teams.
   */
  team_match_id?: number | null;
};

export async function insertMatches(
  pairingId: number, eventId: number, rows: MatchFields[],
) {
  if (!rows.length) return;
  const matches = await table<MatchRow>("club_event_pairing_matches");
  const { error } = await matches.insert(rows.map((row) => ({
    pairing_id: pairingId, event_id: eventId, ...row,
  })));
  if (error) throw new Error(error.message);
}

export async function updateMatch(pairingId: number, id: number, fields: Partial<MatchFields>) {
  const matches = await table<MatchRow>("club_event_pairing_matches");
  const { error } = await matches.update(fields).eq("id", id).eq("pairing_id", pairingId);
  if (error) throw new Error(error.message);
}

export async function deleteMatches(pairingId: number, ids: number[]) {
  if (!ids.length) return;
  const matches = await table<MatchRow>("club_event_pairing_matches");
  const { error } = await matches.delete().in("id", ids).eq("pairing_id", pairingId);
  if (error) throw new Error(error.message);
}

/** Everything in this round, for a redraw. */
export async function clearRound(pairingId: number) {
  const matches = await table<MatchRow>("club_event_pairing_matches");
  const { error } = await matches.delete().eq("pairing_id", pairingId);
  if (error) throw new Error(error.message);
}

export async function setRoundPublished(
  eventId: number, pairingId: number, published: boolean,
) {
  const rounds = await table<RoundRow>("club_event_pairings");
  const { data, error } = await rounds
    .update({ published }).eq("id", pairingId).eq("event_id", eventId)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

export async function deleteRound(eventId: number, pairingId: number) {
  const rounds = await table<RoundRow>("club_event_pairings");
  const { error } = await rounds.delete().eq("id", pairingId).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}
