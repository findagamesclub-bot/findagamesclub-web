import { shuffle } from "./pairings-draw";

/**
 * A team event's draw, which happens at two levels.
 *
 * The client's words: "the draw would be team vs team, and then player vs
 * player from that team". So this does both in one go. Pairing the teams and
 * then leaving somebody to type forty player tables by hand would be the
 * twenty-tables-and-ten-minutes problem the individual draw was built to
 * solve, moved one level up.
 *
 * Board order for the players inside a fixture, not another shuffle: a team
 * event lists its players in the order they will play, the captain decides
 * that order, and shuffling it again would throw away the one decision the
 * captain actually made.
 */

export type DrawTeam = {
  id: number;
  name: string;
  players: { id: number; profileId: string | null; name: string }[];
};

export type DrawnFixture = {
  /** "A", "B", "C": a fixture is a block of tables, not a table. */
  label: string;
  teamOne: DrawTeam;
  /** Null is a bye, which an odd number of teams always produces exactly one of. */
  teamTwo: DrawTeam | null;
  tables: DrawnTable[];
};

export type DrawnTable = {
  /** "A1", "A2": the fixture's letter and the board number inside it. */
  label: string;
  one: { profileId: string | null; name: string } | null;
  two: { profileId: string | null; name: string } | null;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A, B, ... Z, then AA, AB. Twenty-six teams is already a large event. */
export function fixtureLabel(index: number): string {
  let n = index;
  let out = "";
  do {
    out = LETTERS[n % 26] + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Board one against board one, and so on down.
 *
 * player_one is always from team_one, which is the convention the whole
 * fixture rests on and what 0168's trigger holds. A team short of a player
 * leaves that board with one side empty rather than dropping it, so the club
 * can see the gap and fill it.
 */
export function boardOrder(
  label: string, one: DrawTeam, two: DrawTeam | null,
): DrawnTable[] {
  const boards = Math.max(one.players.length, two?.players.length ?? 0);
  const tables: DrawnTable[] = [];

  for (let i = 0; i < boards; i += 1) {
    const a = one.players[i];
    const b = two?.players[i];
    tables.push({
      label: `${label}${i + 1}`,
      one: a ? { profileId: a.profileId, name: a.name } : null,
      two: b ? { profileId: b.profileId, name: b.name } : null,
    });
  }

  return tables;
}

/**
 * Every team paired, every player inside them paired, in one pass.
 *
 * An odd number of teams leaves the last one with a bye rather than dropping
 * it, for the same reason an odd turnout does: a team that entered has to
 * appear on the draw even when there is nobody to play.
 */
export function drawTeamRound(
  teams: DrawTeam[], random: () => number = Math.random,
): DrawnFixture[] {
  const order = shuffle(teams.filter((team) => team.name.trim()), random);
  const fixtures: DrawnFixture[] = [];

  for (let i = 0; i < order.length; i += 2) {
    const label = fixtureLabel(fixtures.length);
    const one = order[i]!;
    const two = order[i + 1] ?? null;
    fixtures.push({ label, teamOne: one, teamTwo: two, tables: boardOrder(label, one, two) });
  }

  return fixtures;
}

/** "4 fixtures, 16 tables" and the like, for the button's confirmation. */
export function teamDrawSummary(fixtures: DrawnFixture[]): string {
  if (!fixtures.length) return "No teams to pair yet.";
  const byes = fixtures.filter((f) => !f.teamTwo).length;
  const played = fixtures.length - byes;
  const tables = fixtures
    .filter((f) => f.teamTwo)
    .reduce((n, f) => n + f.tables.length, 0);

  const parts = [`${played} ${played === 1 ? "fixture" : "fixtures"}`];
  parts.push(`${tables} ${tables === 1 ? "table" : "tables"}`);
  if (byes) parts.push("one bye");
  return parts.join(", ");
}
