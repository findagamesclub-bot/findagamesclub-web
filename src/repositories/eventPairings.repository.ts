import "server-only";

import { table } from "@/lib/supabase/table";
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
  table_label: string;
  player_one: string;
  player_one_id: string | null;
  player_two: string;
  player_two_id: string | null;
  score_one: number | null;
  score_two: number | null;
  position: number;
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
