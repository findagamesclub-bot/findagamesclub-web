import "server-only";

import {
  countByStatus, findPage, findCompetitionGames, findCompetitionGameArmies,
  findStandingLists,
} from "@/repositories/competitions.repository";
import { sideFromRow, type GameSide } from "@/utils/result-army";
import type { MatchSetup } from "@/utils/result-meta";
import { readerArmy } from "./eventPairingArmies.service";
import type { ResultArmy as ReaderArmy } from "@/types/event";
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
        id: entry.id,
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
        disposition: entry.disposition ?? "",
        // Filled in by `withStandingLists` where a page wants them. The row
        // itself only carries the id, so what the league table shows is what
        // was played rather than what the list has since become.
        listId: entry.army_list_id ?? null,
        listName: "",
        listVersion: null,
        listSnapshot: null,
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
            id: match.id,
            playerOne: match.player_one,
            playerOneScore: match.player_one_score,
            playerTwo: match.player_two,
            playerTwoScore: match.player_two_score,
            // The accounts and the setup are columns 0181 added, which a
            // select cannot name against the stale `database.ts`. They come
            // from `competition_games` where a screen needs them, which is
            // the console; the public table reads names and scores and is
            // one wave as it was.
            playerOneId: null,
            playerTwoId: null,
            mission: "", deployment: "", terrain: "",
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
    // One more read for the club page, and only when it has a table to draw.
    // The client asked for the list to show "against club competitions and
    // leagues", and the club page is where most people meet a league at all.
    featured: await withStandingLists([...running, ...finished].map(toCompetition)),
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
  // The editor has to open on the list already named, or the first save would
  // quietly clear every one of them: the rows it posts are built from what it
  // was handed, so a field it never received comes back null.
  return withStandingLists(rows.map((row) => ({
    ...toCompetition(row as CompetitionRow),
    type: (row as CompetitionRow).type,
    status: (row as CompetitionRow).status,
  })));
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

  // The results history page is where somebody reads a season back, so it
  // carries the lists. One read for the whole page, however many tables are
  // on it.
  return {
    items: await withStandingLists(rows.map(toCompetition)),
    total, pages,
  };
}


/**
 * What was played in each game of a competition, for the console.
 *
 * Its own read rather than columns on the round, because every one of them
 * landed after `database.ts` was last generated and `check:columns` is right
 * to refuse a select naming one. Two functions rather than one so a league a
 * few seasons in does not ship a catalogue's worth of army rows to draw a
 * table of names: the public page asks for neither.
 */
export async function getCompetitionGames(competitionId: number): Promise<{
  armies: Record<string, GameSide>;
  setup: Record<number, MatchSetup>;
}> {
  const [games, rows] = await Promise.all([
    findCompetitionGames(competitionId).catch(() => []),
    findCompetitionGameArmies(competitionId).catch(() => []),
  ]);

  const armies: Record<string, GameSide> = {};
  for (const row of rows) armies[`${row.source_id}:${row.side}`] = sideFromRow(row);

  const setup: Record<number, MatchSetup> = {};
  for (const game of games) {
    if (!game.mission && !game.deployment && !game.terrain) continue;
    setup[game.id] = {
      mission: game.mission, deployment: game.deployment, terrain: game.terrain,
    };
  }
  return { armies, setup };
}

/** The accounts behind each game's two names, for the editor to seed. */
export async function getCompetitionGameLinks(
  competitionId: number,
): Promise<Record<number, { one: string | null; two: string | null }>> {
  const games = await findCompetitionGames(competitionId).catch(() => []);
  const out: Record<number, { one: string | null; two: string | null }> = {};
  for (const game of games) {
    out[game.id] = { one: game.player_one_id, two: game.player_two_id };
  }
  return out;
}


/**
 * The same games, in the shape a reader's components take.
 *
 * `getCompetitionGames` answers the console, which seeds pickers and so leads
 * with `factionId`. A reader picks nothing and the round result has to agree
 * with an event's round result about a list, so this goes through the same
 * `readerArmy` the draw does rather than growing a second army type.
 */
export async function getCompetitionGamesForReaders(competitionId: number): Promise<{
  armies: Record<string, ReaderArmy | null>;
  setup: Record<number, MatchSetup>;
}> {
  const [games, rows] = await Promise.all([
    findCompetitionGames(competitionId).catch(() => []),
    findCompetitionGameArmies(competitionId).catch(() => []),
  ]);

  const armies: Record<string, ReaderArmy | null> = {};
  for (const row of rows) armies[`${row.source_id}:${row.side}`] = readerArmy(row);

  const setup: Record<number, MatchSetup> = {};
  for (const game of games) {
    if (!game.mission && !game.deployment && !game.terrain) continue;
    setup[game.id] = {
      mission: game.mission, deployment: game.deployment, terrain: game.terrain,
    };
  }
  return { armies, setup };
}

/**
 * The army lists named on a page of league tables, attached to their rows.
 *
 * One read for every competition on the page rather than one each: a club page
 * draws three tables and the results page draws six, and this codebase counts
 * round trips in waves. A failure costs the list names and nothing else, which
 * is why it catches rather than throws: a league table with no list beside a
 * name is the state every club was in before 0194, and it is a far better page
 * than an error.
 */
export async function withStandingLists<T extends Competition>(
  competitions: T[],
): Promise<T[]> {
  const ids = competitions.map((one) => one.id);
  if (!ids.length) return competitions;

  // Logged, never swallowed. An empty answer here takes the list name off
  // every row and looks exactly like "nobody has named one", which is the
  // quietest way for this to break and the trap `featured.service` already
  // paid for once.
  const rows = await findStandingLists(ids).catch((error: unknown) => {
    console.error("[competitions] standing lists did not load:", error);
    return [];
  });
  if (!rows.length) return competitions;

  const byStanding = new Map(rows.map((row) => [row.standing_id, row]));
  return competitions.map((one) => ({
    ...one,
    standings: one.standings.map((entry) => {
      const found = byStanding.get(entry.id);
      return found
        ? {
            ...entry,
            listId: found.list_id,
            listName: found.list_name,
            listVersion: found.list_version_number,
            listSnapshot: found.snapshot,
          }
        : entry;
    }),
  }));
}
