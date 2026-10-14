import "server-only";

import * as repo from "@/repositories/competitions.repository";
import { setResultList } from "./resultArmies.service";
import type { ResultArmy } from "@/utils/result-army";
import {
  competitionStatus, competitionType, playedFrom, rankStandings,
  statusLabel, typeLabel,
} from "@/utils/competition-meta";

/**
 * Creating and running a club's competitions.
 *
 * Split from the read service for the same reason as the board: reads stay a
 * pure mapper. Every refusal here is really the manage policy from 0024
 * refusing; the checks are for the wording, not for the security.
 */

type Result = { ok: true; id?: number } | { ok: false; error: string };

/**
 * The army a row names has to be one this club's catalogue holds.
 *
 * 0136 mirrors every standing into `game_result_armies`, so a faction the
 * catalogue has never heard of refuses the whole table. The trigger puts the
 * player's name on the end of the code, which is the only way somebody
 * scanning twenty rows can tell which one to open.
 */
const ARMY_REFUSALS: [string, string][] = [
  ["RESULT_BAD_FACTION", "is not a faction in this club's catalogue"],
  ["RESULT_BAD_DETACHMENT", "is not a detachment that faction has"],
  ["RESULT_BAD_DISPOSITION", "is not a disposition that detachment offers"],
];

function refusal(raw: string, fallback: string): string {
  if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
    return "Only the club can change its competitions.";
  }
  for (const [code, said] of ARMY_REFUSALS) {
    if (!raw.includes(code)) continue;
    // "RESULT_BAD_FACTION for Joe Matthews", which the trigger builds.
    const who = raw.slice(raw.indexOf(code) + code.length).replace(/^\s*for\s*/, "").trim();
    return who
      ? `What ${who} played ${said}. Open their row and pick from the list.`
      : `One of the armies ${said}. Open each row and pick from the list.`;
  }
  if (raw.includes("_len") || raw.includes("too long")) {
    return "That is too long. Trim it and try again.";
  }
  console.error("[competitions] unexpected refusal:", raw);
  return fallback;
}

export type CompetitionForm = {
  title: string;
  type: string;
  status: string;
  season: string;
  game: string;
  summary: string;
  startDate: string;
  endDate: string;
};

function clean(form: CompetitionForm) {
  const type = competitionType(form.type);
  const status = competitionStatus(form.status);

  return {
    title: form.title.trim().slice(0, 160),
    type,
    typeLabel: typeLabel(type),
    status,
    statusLabel: statusLabel(status),
    season: form.season.trim().slice(0, 80),
    game: form.game.trim().slice(0, 120),
    summary: form.summary.trim().slice(0, 2000),
    // Empty is a real answer: a ladder that runs forever has no end date, and
    // an empty string is not a date the column will take.
    startDate: form.startDate.trim() || null,
    endDate: form.endDate.trim() || null,
  };
}

export async function createCompetition(
  clubId: number, form: CompetitionForm,
): Promise<Result> {
  const input = clean(form);
  if (!input.title) return { ok: false, error: "Give the competition a name." };

  try {
    const row = await repo.insertCompetition(clubId, input);
    return { ok: true, id: row.id };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not create that. Try again.") };
  }
}

export async function editCompetition(id: number, form: CompetitionForm): Promise<Result> {
  const input = clean(form);
  if (!input.title) return { ok: false, error: "Give the competition a name." };

  try {
    await repo.updateCompetition(id, input);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not save that. Try again.") };
  }
}

export async function removeCompetition(id: number): Promise<Result> {
  try {
    await repo.deleteCompetition(id);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not delete that. Try again.") };
  }
}

/**
 * A row as the browser posted it, which is to say: not to be trusted.
 *
 * The action `JSON.parse`s this out of a form field and casts it, so every
 * field here is a claim rather than a fact. A tab left open across a deploy
 * posts the shape the old bundle knew, which is how `detachment` arrived
 * undefined and `.trim()` threw a TypeError the club read as "Could not save
 * the table. Try again." Optional, and read through `text()` below.
 */
export type StandingForm = {
  memberName?: string;
  profileId?: string | null;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  notes?: string;
  faction?: string;
  detachment?: string;
  disposition?: string;
};

const text = (value: unknown, cap: number) =>
  (typeof value === "string" ? value : "").trim().slice(0, cap);
const count = (value: unknown) =>
  Math.max(0, Math.floor(typeof value === "number" ? value : Number(value) || 0));

/**
 * The whole table at once, ranked here rather than by whoever typed it.
 *
 * Rank is a position in a sorted list, not a number a club should be keeping
 * in its head. Played is the three results added up for the same reason.
 */
export async function saveStandings(
  competitionId: number, rows: StandingForm[],
): Promise<Result> {
  const named = rows
    .map((row) => ({
      memberName: text(row.memberName, 120),
      profileId: typeof row.profileId === "string" ? row.profileId : null,
      notes: text(row.notes, 300),
      faction: text(row.faction, 120),
      detachment: text(row.detachment, 120),
      // A disposition belongs to a detachment, so one without the other is a
      // value with nothing to hang off. The trigger in 0136 refuses it; this
      // drops it so the rest of the table still saves.
      disposition: text(row.detachment, 120) ? text(row.disposition, 120) : "",
      wins: count(row.wins),
      draws: count(row.draws),
      losses: count(row.losses),
      points: count(row.points),
    }))
    .filter((row) => row.memberName);

  try {
    await repo.replaceStandings(competitionId, rankStandings(named).map((row) => ({
      member_name: row.memberName,
      profile_id: row.profileId,
      rank: 0,
      played: playedFrom(row.wins, row.draws, row.losses),
      wins: row.wins, draws: row.draws, losses: row.losses, points: row.points,
      notes: row.notes,
      faction: row.faction,
      detachment: row.detachment,
      disposition: row.disposition,
    })));
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not save the table. Try again.") };
  }
}

export type RoundForm = {
  postedOn: string;
  title: string;
  summary: string;
  matches: {
    /** Absent on a game being added. Present keeps its armies across a save. */
    id?: number | string | null;
    playerOne: string; playerOneScore: string;
    playerTwo: string; playerTwoScore: string;
    /** The accounts behind the names, where the club named a member. */
    playerOneId?: string | null;
    playerTwoId?: string | null;
  }[];
};

/**
 * A round, and the games in it.
 *
 * One call since 0181, where it used to be an insert or update followed by a
 * delete-and-reinsert of the games. A game owns army rows now, so a game that
 * survives an edit has to keep its id: without that, saving a round to fix a
 * typo in its title took every army in it, through the delete path 0164's
 * rule requires.
 */
export async function saveRound(params: {
  competitionId: number;
  roundId: number | null;
  position: number;
  form: RoundForm;
}): Promise<Result> {
  const title = params.form.title.trim().slice(0, 160);
  const postedOn = params.form.postedOn.trim() || null;
  const summary = params.form.summary.trim().slice(0, 2000);

  if (!title && !postedOn && !summary) {
    return { ok: false, error: "Give the round a name or a date." };
  }

  // Both names, or it is not a game. A half-filled row would render as
  // "Alice v" on the club page.
  const games = params.form.matches
    .map((m) => ({
      // Everything here was parsed out of a form field, so it is a claim
      // rather than a fact: `text()` answers "" for anything that is not a
      // string, which is the trap `saveStandings` already paid for.
      id: m.id ? String(m.id) : "",
      playerOne: text(m.playerOne, 120),
      playerOneScore: text(m.playerOneScore, 20),
      playerOneId: text(m.playerOneId, 40),
      playerTwo: text(m.playerTwo, 120),
      playerTwoScore: text(m.playerTwoScore, 20),
      playerTwoId: text(m.playerTwoId, 40),
    }))
    .filter((m) => m.playerOne && m.playerTwo);

  try {
    const id = await repo.saveCompetitionRound({
      competitionId: params.competitionId,
      roundId: params.roundId,
      postedOn, title, summary, games,
    });
    return { ok: true, id };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not save that round. Try again.") };
  }
}

/**
 * What was played in one game of a round.
 *
 * The same two writes a table of a draw makes, in the same order and for the
 * same reason: a list hangs off the army row this creates, so naming one
 * before the faction exists has nothing to attach to.
 */
export async function saveGameResult(params: {
  matchId: number;
  armies: { one?: Partial<ResultArmy>; two?: Partial<ResultArmy> };
  lists: { one: number | null; two: number | null };
  setup: { mission: string; deployment: string; terrain: string };
}): Promise<Result> {
  try {
    await repo.saveCompetitionMatchResult({ matchId: params.matchId,
      armies: params.armies, ...params.setup });

    for (const side of ["one", "two"] as const) {
      if (!(params.armies[side]?.factionId ?? "").trim()) continue;
      await setResultList("competition_match", params.matchId, side, params.lists[side]);
    }
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not save that game. Try again.") };
  }
}

export async function removeRound(id: number): Promise<Result> {
  try {
    await repo.deleteRound(id);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not delete that round. Try again.") };
  }
}
