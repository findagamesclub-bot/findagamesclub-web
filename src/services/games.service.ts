import "server-only";

import { findOwnedClubs } from "@/repositories/ownerInbox.repository";
import { isLocked, safeDeployment, toConfirmation, type ConfirmationState }
  from "@/utils/result-meta";

import * as repo from "@/repositories/games.repository";
import { londonToday } from "./bookingCalendar.service";
import { suggestOpponents, winRate, type Suggestion } from "@/utils/opponent-finder";

export type MyGame = {
  id: number;
  club: { slug: string; name: string; logoUrl: string | null };
  date: string;
  time: string | null;
  title: string;
  /** The other person, whether they hold an account here or not. */
  opponentId: string | null;
  opponentName: string;
  /** Written from this member's side, whichever side of the row they are on. */
  myScore: number | null;
  theirScore: number | null;
  myArmy: string;
  theirArmy: string;
  outcome: "won" | "lost" | "drew" | null;
  /** They booked it, so their score is the first of the pair in the row. */
  iBooked: boolean;
  played: boolean;
  /** Legacy's Match context: how the game was set up. */
  mission: string;
  deployment: string;
  terrain: string;
  confirmation: ConfirmationState;
  /**
   * Settled or contested, so the club owns it now. The database refuses the
   * write either way; this lets the dialog say so instead of failing on save.
   */
  locked: boolean;
  /**
   * This viewer runs the club, so they may set the result state and edit one
   * that is already settled. False on every game at a club they only play at.
   */
  canManageClub: boolean;
};

export type Record = {
  opponentId: string;
  opponentName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  lastPlayed: string | null;
};

/** A page of games. Twenty-five is a screen and a half of history. */
export const PAGE = 25;

/**
 * The member's own games, newest first, told from their side.
 *
 * The row stores scores in the booking's order — whoever booked, then their
 * opponent — so it means the same thing whoever wrote it. Turning that around
 * per reader happens here, once, rather than in every component that shows a
 * scoreline.
 */
export async function getMyGames(profileId: string, page = 1): Promise<MyGame[]> {
  const from = (Math.max(1, page) - 1) * PAGE;
  // Which clubs this person runs, asked once rather than per row. Somebody can
  // play at four clubs and own one of them, and only that one's results are
  // theirs to settle.
  const [rows, ownedClubs] = await Promise.all([
    repo.findMyGames(profileId, from, from + PAGE - 1),
    findOwnedClubs(profileId).catch(() => []),
  ]);
  const owned = new Set(ownedClubs.map((club) => club.id));
  const today = londonToday();

  return rows.map(({ club_bookings: row }) => {
    const iBooked = row.booked_by === profileId;
    const myScore = iBooked ? row.booked_by_score : row.opponent_score;
    const theirScore = iBooked ? row.opponent_score : row.booked_by_score;

    const other = iBooked
      ? { id: row.opponent_profile_id, name: row.opponent?.full_name || row.opponent_name }
      : { id: row.booked_by, name: row.booker?.full_name || "Club member" };

    return {
      id: row.id,
      club: {
        slug: row.clubs.slug,
        name: row.clubs.name,
        logoUrl: row.clubs.logo_url,
      },
      date: row.session_date,
      time: row.session_time,
      title: row.game_title || "Table booking",
      opponentId: other.id,
      opponentName: other.name?.trim() || "an opponent",
      myScore,
      theirScore,
      myArmy: iBooked ? row.booked_by_army : row.opponent_army,
      theirArmy: iBooked ? row.opponent_army : row.booked_by_army,
      outcome: myScore === null || theirScore === null
        ? null
        : myScore > theirScore ? "won" : myScore < theirScore ? "lost" : "drew",
      iBooked,
      // A game in the future cannot have a result, so it is not asking for one.
      played: row.session_date <= today,
      mission: (row.result_mission ?? "").trim(),
      deployment: (row.result_deployment ?? "").trim(),
      terrain: (row.result_terrain ?? "").trim(),
      confirmation: toConfirmation(row.result_confirmation),
      locked: isLocked(row.result_confirmation),
      canManageClub: owned.has(row.club_id),
    };
  });
}

/** Wins, draws and losses per opponent. One grouped query, counted in SQL. */
export async function getRecord(): Promise<Record[]> {
  const rows = await repo.findHeadToHead();
  return rows.map((row) => ({
    opponentId: row.opponent_id,
    opponentName: row.opponent_name,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    lastPlayed: row.last_played,
  }));
}

export async function recordResult(params: {
  bookingId: number;
  /** As the member typed them: their own score first. */
  myScore: number;
  theirScore: number;
  myArmy: string;
  theirArmy: string;
  iBooked: boolean;
  mission?: string;
  deployment?: string;
  terrain?: string;
  /** Only the club's choice counts; the function drops everyone else's. */
  confirmation?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { myScore, theirScore } = params;
  if (!Number.isFinite(myScore) || !Number.isFinite(theirScore)) {
    return { ok: false, error: "Put a number in both boxes." };
  }
  if (myScore < 0 || theirScore < 0) {
    return { ok: false, error: "Scores cannot be negative." };
  }

  try {
    // Turned back into the booking's order on the way in, so the row is always
    // read the same way regardless of which player filled the form in.
    await repo.saveResult({
      bookingId: params.bookingId,
      bookedByScore: params.iBooked ? myScore : theirScore,
      opponentScore: params.iBooked ? theirScore : myScore,
      bookedByArmy: params.iBooked ? params.myArmy : params.theirArmy,
      opponentArmy: params.iBooked ? params.theirArmy : params.myArmy,
      mission: (params.mission ?? "").trim(),
      // Never sent raw: the column has a check constraint, and a stale value
      // from an old page would be a 23514 rather than a message.
      deployment: safeDeployment(params.deployment),
      terrain: (params.terrain ?? "").trim(),
      confirmation: (params.confirmation ?? "").trim(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: resultRefusal(error, params.bookingId) };
  }
}

/**
 * The club recording a result on a game it did not play in.
 *
 * Scores go in as booked-by and opponent, not "mine" and "theirs": there is no
 * "mine" when the person saving it was not on the table. record_booking_result
 * still decides whether they are allowed to.
 */
export async function recordClubResult(params: {
  bookingId: number;
  homeScore: number;
  awayScore: number;
  homeArmy: string;
  awayArmy: string;
  mission?: string;
  deployment?: string;
  terrain?: string;
  confirmation?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(params.homeScore) || !Number.isFinite(params.awayScore)) {
    return { ok: false, error: "Put a number in both boxes." };
  }
  if (params.homeScore < 0 || params.awayScore < 0) {
    return { ok: false, error: "Scores cannot be negative." };
  }

  try {
    await repo.saveResult({
      bookingId: params.bookingId,
      bookedByScore: params.homeScore,
      opponentScore: params.awayScore,
      bookedByArmy: params.homeArmy,
      opponentArmy: params.awayArmy,
      mission: (params.mission ?? "").trim(),
      deployment: safeDeployment(params.deployment),
      terrain: (params.terrain ?? "").trim(),
      confirmation: (params.confirmation ?? "").trim(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: resultRefusal(error, params.bookingId) };
  }
}

/** Every refusal record_booking_result raises, worded for whoever hit it. */
const RESULT_ERRORS: [string, string][] = [
  ["RESULT_LOCKED",
   "This result has been settled by the club. Ask them if it needs changing."],
  ["RESULT_NOT_YOURS", "Only the players or the club can record that result."],
  ["RESULT_CANCELLED", "That booking was cancelled."],
  ["RESULT_NO_BOOKING", "That game is no longer there."],
  ["RESULT_SCORES_MISSING", "Put a number in both boxes."],
  ["RESULT_SCORES_RANGE", "Those scores are out of range."],
  ["RESULT_BAD_STATE", "Choose one of the four states."],
  ["RESULT_BAD_DEPLOYMENT", "Choose a deployment from the list."],
  // The wording 0030 used, kept so a database that has not run 0044 yet still
  // says something sensible.
  ["Only the players", "Only the players or the club can record that result."],
  ["cancelled", "That booking was cancelled."],
];

function resultRefusal(error: unknown, bookingId: number): string {
  const raw = error instanceof Error ? error.message : String(error);
  const known = RESULT_ERRORS.find(([code]) => raw.includes(code));
  if (known) return known[1];

  console.error("record result failed", { bookingId, raw });
  return "Could not save that result. Try again.";
}

export async function removeResult(bookingId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await repo.clearResult(bookingId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: resultRefusal(error, bookingId) };
  }
}


export type Rivalry = {
  key: string;
  one: { id: string; name: string; wins: number };
  two: { id: string; name: string; wins: number };
  played: number;
  draws: number;
  lastPlayed: string | null;
  /** Nobody ahead. Legacy calls these the ones worth watching. */
  level: boolean;
};

/**
 * A club's rivalry leaderboard, most-played first.
 *
 * Ranked by games rather than by wins on purpose: a rivalry is about how often
 * two people meet, not how well one of them does. A 6-0 whitewash is a worse
 * story than a 3-3 that has run all season.
 */
export async function getClubRivalries(clubId: number): Promise<Rivalry[]> {
  const rows = await repo.findClubRivalries(clubId);

  return rows.map((row) => ({
    key: `${row.member_one}:${row.member_two}`,
    one: { id: row.member_one, name: row.member_one_name, wins: row.wins_one },
    two: { id: row.member_two, name: row.member_two_name, wins: row.wins_two },
    played: row.played,
    draws: row.draws,
    lastPlayed: row.last_played,
    level: row.wins_one === row.wins_two,
  }));
}

export type OpponentFinder = {
  /** The reader's own win rate, shown beside the heading. */
  myWinRate: number;
  myGames: number;
  suggestions: Suggestion[];
};

/**
 * Who this member should play next at this club.
 *
 * Legacy works this out in the browser from a payload carrying every member's
 * stats. That is fine at forty members and a lot of rows at a thousand, so the
 * counting happens in the database and only the scoring is done here.
 */
export async function getOpponentFinder(
  clubId: number,
  viewerId: string,
  roster: {
    profileId: string; fullName: string;
    games: string[]; playStyle: string[]; tierKey: string | null;
  }[],
  priorityTiers: Set<string> = new Set(),
): Promise<OpponentFinder> {
  const [form, record] = await Promise.all([
    repo.findClubForm(clubId).catch(() => []),
    // The viewer's own history, which is the heaviest signal in the scoring.
    getRecord().catch(() => []),
  ]);

  const stats = new Map(form.map((row) => [row.member_id, row]));
  const mine = stats.get(viewerId);
  const me = roster.find((member) => member.profileId === viewerId);

  const suggestions = suggestOpponents(
    {
      id: viewerId,
      games: me?.games ?? [],
      playStyle: me?.playStyle ?? [],
      played: mine?.played ?? 0,
      wins: mine?.wins ?? 0,
      history: new Map(record.map((row) => [row.opponentId, row.played])),
    },
    roster.map((member) => {
      const theirs = stats.get(member.profileId);
      return {
        id: member.profileId,
        name: member.fullName,
        games: member.games,
        playStyle: member.playStyle,
        played: theirs?.played ?? 0,
        wins: theirs?.wins ?? 0,
        priority: member.tierKey ? priorityTiers.has(member.tierKey) : false,
      };
    }),
  );

  return {
    myWinRate: winRate(mine?.played ?? 0, mine?.wins ?? 0),
    myGames: mine?.played ?? 0,
    suggestions,
  };
}
