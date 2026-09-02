import "server-only";

import * as repo from "@/repositories/games.repository";
import { canonicalGame } from "@/utils/game-label";
import { memberRecord, scoreTrend, type MemberRecord, type TrendPoint }
  from "@/utils/member-stats";

export type GrudgeMatch = {
  id: number;
  /** A table booking or a competition round. Both count towards the record. */
  source: string;
  date: string | null;
  game: string;
  competition: string;
  opponentId: string | null;
  opponentName: string;
  myScore: number;
  theirScore: number;
  outcome: "won" | "lost" | "drew";
};

export type GrudgeOpponent = {
  id: string | null;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
};

export type ClubTracker = {
  club: { id: number; slug: string; name: string };
  record: MemberRecord;
  scoreFor: number;
  scoreAgainst: number;
  /** Most-played first. Legacy calls these the head-to-head leaders. */
  headToHeads: GrudgeOpponent[];
  matches: GrudgeMatch[];
  trend: TrendPoint[];
};

/**
 * How a member has done at each club, and against whom.
 *
 * Legacy's grudge tracker, minus the army analytics half of its Insights tab:
 * factions, detachments and unit performance all come from the Army Builder,
 * which is Milestone 3 (ARCHITECTURE.md). Everything here is read off games we
 * already hold.
 *
 * Scoped to clubs the reader is also in, matching the rest of the profile: the
 * function behind it refuses a club the reader is not a member of, so passing
 * a wider list would return nothing rather than leak anything.
 */
export async function getGrudgeTracker(
  memberId: string,
  clubs: { id: number; slug: string; name: string }[],
): Promise<ClubTracker[]> {
  const trackers = await Promise.all(
    clubs.map(async (club) => {
      const rows = await repo.findMemberGames(club.id, memberId).catch(() => []);
      if (!rows.length) return null;

      const matches: GrudgeMatch[] = rows.map((row) => ({
        id: row.ref_id,
        source: row.source,
        date: row.played_on,
        game: canonicalGame(row.game_title),
        competition: row.competition,
        opponentId: row.opponent_id,
        opponentName: row.opponent_name.trim() || "Club member",
        myScore: row.my_score,
        theirScore: row.their_score,
        outcome: row.my_score > row.their_score ? "won"
          : row.my_score < row.their_score ? "lost" : "drew",
      }));

      // The same maths the member's own dashboard uses, rather than a second
      // copy of it that can drift: a win rate must not depend on whose page
      // it is being read on.
      const games = matches.map((m) => ({
        date: m.date ?? "",
        outcome: m.outcome,
        myScore: m.myScore,
        theirScore: m.theirScore,
      }));

      return {
        club,
        record: memberRecord(games),
        scoreFor: matches.reduce((n, m) => n + m.myScore, 0),
        scoreAgainst: matches.reduce((n, m) => n + m.theirScore, 0),
        headToHeads: rivals(matches),
        matches,
        trend: scoreTrend(games),
      } satisfies ClubTracker;
    }),
  );

  return trackers
    .filter((t): t is ClubTracker => t !== null)
    .sort((a, b) => b.record.played - a.record.played);
}

/** Who they play, most often first. Unregistered opponents count by name. */
function rivals(matches: GrudgeMatch[]): GrudgeOpponent[] {
  const held = new Map<string, GrudgeOpponent>();

  for (const m of matches) {
    const key = m.opponentId ?? `name:${m.opponentName.toLowerCase()}`;
    const row = held.get(key) ?? {
      id: m.opponentId, name: m.opponentName,
      played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0,
    };
    row.played += 1;
    if (m.outcome === "won") row.won += 1;
    else if (m.outcome === "lost") row.lost += 1;
    else row.drawn += 1;
    row.scoreFor += m.myScore;
    row.scoreAgainst += m.theirScore;
    held.set(key, row);
  }

  return [...held.values()].sort((a, b) => b.played - a.played
    || b.won - a.won
    || a.name.localeCompare(b.name));
}
