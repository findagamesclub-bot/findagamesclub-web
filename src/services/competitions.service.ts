import "server-only";

import { countByStatus, findPage } from "@/repositories/competitions.repository";
import type { CompetitionRow } from "@/repositories/competitions.repository";
import type { Competition } from "@/types/competition";

/** How many fit on the club page before it stops being a club page. */
export const CLUB_PAGE_LIMIT = 3;
/** A page of the full list. */
export const PER_PAGE = 6;

const label = (written: string, fallback: string) =>
  written.trim() || (fallback ? fallback[0].toUpperCase() + fallback.slice(1) : "");

function toCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    title: row.title,
    typeLabel: label(row.type_label, row.type),
    statusLabel: label(row.status_label, row.status),
    isCompleted: row.status === "completed",
    season: row.season,
    game: row.game,
    summary: row.summary,
    startDate: row.start_date,
    endDate: row.end_date,

    standings: [...(row.club_competition_standings ?? [])]
      // Rank is what the club decided; ties fall back to points.
      .sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.points - a.points)
      .map((entry) => ({
        rank: entry.rank,
        memberName: entry.member_name,
        profileId: entry.profile_id,
        played: entry.played,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        points: entry.points,
        recordLabel:
          entry.record_label.trim() || `${entry.wins}-${entry.draws}-${entry.losses}`,
        notes: entry.notes,
        faction: entry.faction,
        detachment: entry.detachment,
      })),

    updates: [...(row.club_competition_updates ?? [])]
      // Newest round first: the last result posted is the news.
      .sort((a, b) => (b.posted_on ?? "").localeCompare(a.posted_on ?? ""))
      .map((update) => ({
        id: update.id,
        postedOn: update.posted_on,
        title: update.title,
        summary: update.summary,
        matches: [...(update.club_competition_matches ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((match) => ({
            playerOne: match.player_one,
            playerOneScore: match.player_one_score,
            playerTwo: match.player_two,
            playerTwoScore: match.player_two_score,
          })),
      })),
  };
}

export type CompetitionOverview = {
  featured: Competition[];
  activeCount: number;
  completedCount: number;
};

/**
 * What the club page shows: the competitions running now, capped, with the
 * totals beside them.
 *
 * Capped rather than paginated here because this is a summary on somebody
 * else's page. A club running twenty leagues gets three and a link, the same
 * way its events and members do. Round-by-round history is not fetched at all.
 */
export async function getCompetitionOverview(clubId: number): Promise<CompetitionOverview> {
  const [activeCount, completedCount] = await Promise.all([
    countByStatus(clubId, "active"),
    countByStatus(clubId, "completed"),
  ]);

  if (!activeCount && !completedCount) {
    return { featured: [], activeCount: 0, completedCount: 0 };
  }

  const running = activeCount
    ? await findPage(clubId, { status: "active", from: 0, to: CLUB_PAGE_LIMIT - 1 })
    : [];

  // Finished ones fill the remaining slots rather than hiding behind the link.
  // A club with one league and one old campaign should show both; a club with
  // fourteen running gets three and the link, and none of its history.
  const spare = CLUB_PAGE_LIMIT - running.length;
  const finished = spare > 0 && completedCount
    ? await findPage(clubId, { status: "completed", from: 0, to: spare - 1 })
    : [];

  return {
    featured: [...running, ...finished].map(toCompetition),
    activeCount,
    completedCount,
  };
}

/** One page of the full list, with its history. */
/**
 * Every competition a club runs, whatever its state, for the club itself.
 *
 * The public page splits active from completed and pages through them. An
 * owner setting one up needs the lot in one list, and needs the raw `type` and
 * `status` rather than their labels so the form can preselect them.
 */
export type ManagedCompetition = Competition & { type: string; status: string };

export async function getManagedCompetitions(clubId: number): Promise<ManagedCompetition[]> {
  const rows = await findPage(clubId, { from: 0, to: 199, withHistory: true });
  return rows.map((row) => ({
    ...toCompetition(row as CompetitionRow),
    type: (row as CompetitionRow).type,
    status: (row as CompetitionRow).status,
  }));
}

export async function getCompetitionPage(
  clubId: number,
  status: "active" | "completed",
  page: number,
): Promise<{ items: Competition[]; total: number; pages: number }> {
  const total = await countByStatus(clubId, status);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(Math.max(1, page), pages);
  const from = (current - 1) * PER_PAGE;

  const rows = total
    ? await findPage(clubId, { status, from, to: from + PER_PAGE - 1, withHistory: true })
    : [];

  return { items: rows.map(toCompetition), total, pages };
}
