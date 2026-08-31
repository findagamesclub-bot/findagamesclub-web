import "server-only";

import * as repo from "@/repositories/competitions.repository";
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

function refusal(raw: string, fallback: string): string {
  if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
    return "Only the club can change its competitions.";
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

export type StandingForm = {
  memberName: string;
  profileId: string | null;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  notes: string;
  faction: string;
};

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
      ...row,
      memberName: row.memberName.trim().slice(0, 120),
      wins: Math.max(0, Math.floor(row.wins) || 0),
      draws: Math.max(0, Math.floor(row.draws) || 0),
      losses: Math.max(0, Math.floor(row.losses) || 0),
      points: Math.max(0, Math.floor(row.points) || 0),
    }))
    .filter((row) => row.memberName);

  try {
    await repo.replaceStandings(competitionId, rankStandings(named).map((row) => ({
      member_name: row.memberName,
      profile_id: row.profileId,
      rank: 0,
      played: playedFrom(row.wins, row.draws, row.losses),
      wins: row.wins, draws: row.draws, losses: row.losses, points: row.points,
      notes: row.notes.trim().slice(0, 300),
      faction: row.faction.trim().slice(0, 120),
      detachment: "",
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
    playerOne: string; playerOneScore: string;
    playerTwo: string; playerTwoScore: string;
  }[];
};

/** A round, and the games in it. Legacy calls these history entries. */
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
  const matches = params.form.matches
    .map((m) => ({
      playerOne: m.playerOne.trim().slice(0, 120),
      playerOneScore: m.playerOneScore.trim().slice(0, 20),
      playerTwo: m.playerTwo.trim().slice(0, 120),
      playerTwoScore: m.playerTwoScore.trim().slice(0, 20),
    }))
    .filter((m) => m.playerOne && m.playerTwo);

  try {
    const id = params.roundId
      ?? (await repo.insertRound(params.competitionId, {
        postedOn, title, summary, position: params.position,
      })).id;

    if (params.roundId) {
      await repo.updateRound(params.roundId, { postedOn, title, summary });
    }
    await repo.replaceMatches(id, matches);
    return { ok: true, id };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not save that round. Try again.") };
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
